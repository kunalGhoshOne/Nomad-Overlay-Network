const Docker = require('dockerode');
const Shell  = require("shelljs");
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { stderr } = require('process');
const consul = require("./consul");
let buffer = '';
let ENVKEY = process.env.ENV_KEY_TO_CHECK?process.env.ENV_KEY_TO_CHECK:"NOMAD_KG_OVERLAY_NETWORK";
const containers_folder ="/containers";
const NETWORK_NAME = process.env.OVERLAY_DOCKER_SWARM_NETWORK_NAME?process.env.OVERLAY_DOCKER_SWARM_NETWORK_NAME:null;

if(NETWORK_NAME == null){
    console.error(
        `Overlay network name need to be defined please set 
        this in docker-compose.yml OVERLAY_DOCKER_SWARM_NETWORK_NAME='your_overlay_network_name' `,1);
    process.exit(1);
}

const docker = new Docker({ socketPath: '/var/run/docker.sock' });

function save_container_data(container_id,container_name,container_ip){
    let container_folder_to_create=containers_folder+"/"+container_name;
    let container_name_file=container_folder_to_create+"/"+container_id;
    let checkfolder_fst=fs.existsSync(container_folder_to_create);
    if(!checkfolder_fst){
        fs.mkdirSync(container_folder_to_create);
    }
    let checkfolder=fs.existsSync(container_folder_to_create);
    if(checkfolder){
        console.log(container_folder_to_create,"container_folder_to_create",container_name_file,"container_name_file");
        fs.writeFileSync(container_name_file,container_ip);
        let checkfile=fs.existsSync(container_name_file);
        if(checkfile){
            console.log(container_name_file,"container_name_file");
            return true
        }
    }
    return false;
}

function save_container(container_id,container_name,container_ip){
    let check_data=false;
    for (let k = 0; k < 3; k++) {
        let returned_data=save_container_data(container_id,container_name,container_ip);
        if(returned_data){
            check_data=true;
            break;
        }
    }
    if(check_data){
        return true;
    }else{
        return false;
    }
}

function remove_container(container_name,container_id){
    for (let k = 0; k < 3; k++) {
        let returned_data=remove_container_data(container_name,container_id);
        if(returned_data){
            return true;
        }
    }
    return false;
}

function remove_container_data(container_name,container_id){
    let container_id_folder=containers_folder+"/"+container_name;
    let check_file_exists=fs.existsSync(container_id_folder);
    if(check_file_exists){
        fs.rmSync(container_id_folder,{recursive: true});
        let checkfolder=fs.existsSync(container_id_folder);
        if(checkfolder){
            return true;
        }
    }
    
    return false;
}


function check_cont_exists(container_name,container_id){
    let check_folder=fs.existsSync(containers_folder+"/"+container_name);
    if(!check_folder){
        return false;
    }else{
        return true;
    }
    let files=fs.readdirSync(containers_folder+"/"+container_name);
    console.log(files);
    let ip_addr="";
    files.forEach(file => {
        let file_content=fs.readFileSync(containers_folder+"/"+container_name+"/"+file,{ encoding: 'utf8', flag: 'r' });
        ip_addr=file_content;
        if(ip_addr != ""){
            return [ip_addr,file.toString()];
        }
    });
    return false;
}
function get_ip_from_deleted_container(container_name,container_id){
    let check_folder=fs.existsSync(containers_folder+"/"+container_name);
    if(!check_folder){
        return false;
    }
    let files=fs.readdirSync(containers_folder+"/"+container_name);
    console.log(files);
    let ip_addr="";
    let address_get=null;
    files.forEach(file => {
        console.log("file ",containers_folder+"/"+container_name+"/"+file);
        let file_content=fs.readFileSync(`${containers_folder}/${container_name}/${file}`,{ encoding: 'utf8', flag: 'r' });
        
        address_get=file_content;
        console.log("file_content",file_content,address_get,"length",address_get.toString().trim().length);
    });
    if(address_get != null){
        if(address_get.toString().trim().length > 0){
            return address_get;
        }
    }
    
    return false;
}



async function add_container_to_overlay(data,nomad_task_name,nomad_job_name){

    const newConfig = {
        Image: data.Config.Image,
        name: data.Name.replace(/^\//, ''), // Remove leading slash from container name
        Env: data.Config.Env,
        Cmd: data.Config.Cmd,
        Entrypoint: data.Config.Entrypoint,
        Volumes: data.Config.Volumes,
        WorkingDir: data.Config.WorkingDir,
        ExposedPorts: data.Config.ExposedPorts,
        HostConfig: {
            ...data.HostConfig,
            NetworkMode: NETWORK_NAME,
            PortBindings: data.HostConfig.PortBindings,
            Binds: data.HostConfig.Binds,
            Mounts: data.HostConfig.Mounts,
            RestartPolicy: data.HostConfig.RestartPolicy,/*{
                '80/tcp': [ { HostIp: '0.0.0.0', HostPort: '443' } ],
                '80/tcp': [ { HostIp: '0.0.0.0', HostPort: '80' } ]
              }*/
            //port_env_data
            // {"80/tcp":[{"HostIp":"0.0.0.0","HostPort":"80"}]}
        }
    };
    // Remove existing container if already running
    try {
        let existingContainer = docker.getContainer(data.Id);
        await existingContainer.stop();
        await existingContainer.remove();
        console.log(`Existing container ${data.Name.replace(/^\//, '')} removed.`);
    } catch (err) {
        console.log("No existing container to remove.");
    }

    
    try {


        let newContainer = await docker.createContainer(newConfig);
        await newContainer.start();
        let containerName = data.Name.replace(/^\//, '');
        console.log(`🚀 container '${containerName}' started on '${NETWORK_NAME}'.`);

        // Step 4: Retrieve and print container IP address
        let inspectData = await newContainer.inspect();
        let containerIP = inspectData.NetworkSettings.Networks[NETWORK_NAME]?.IPAddress;
        
        if (containerIP) {
            let is_added_to_consul=false;
            console.log(` ${containerName} Container IP: ${containerIP}`);
            (async () => {
                try {
                  const result = await consul.register(nomad_task_name+"-"+nomad_job_name,containerName,containerIP);
                  
                  if(result){
                    is_added_to_consul=true;
                    console.log('Service registered successfully:', result,nomad_task_name+"-"+nomad_job_name,containerName,containerIP);
                  }else{
                    
                    console.error('Failed to register service:', error,nomad_task_name+"-"+nomad_job_name,containerName,containerIP);
                  }
                } catch (error) {
                    error=JSON.parse(error);
                    if(error.status == true){
                        is_added_to_consul=true;
                        console.error('Service registered successfully', error,nomad_task_name+"-"+nomad_job_name,containerName,containerIP);
                    }else{
                        console.error('Failed to register service:', error,nomad_task_name+"-"+nomad_job_name,containerName,containerIP);
                    }
                    
                }
              })();
            let save_data=save_container(inspectData.Id,containerName,containerIP);
            console.log(`save_container(${inspectData.Id},${containerName},${containerIP});`,"save_Data",save_data);
             
        } else {
            console.log("⚠️ Unable to retrieve IP address.");
        }

        
    } catch (error) {
        console.error("❌ Error:", error);
    }
    
}



function handleEvent(event){
    const { status, Ty, id } = event;
    const CONTAINER_NAME= event.Actor.Attributes.name;
    if (status === 'start' && status != 'die' && status != 'destroy' && status != 'create') {

        docker.listContainers(function (err, containers) {
            containers.forEach(function (containerInfo) {
                if (containerInfo.Id === id) {
                    docker.getContainer(id).inspect((err, container_data) => {
                        if (err) {
                            console.error(`Error inspecting container ${id}:`, err);
                            return;
                        }
                        var container_envs=container_data.Config.Env;
                        let want_to_add=false;
                        var nomad_job_name=null;
                        var nomad_task_name=null;
                        var allenvs = container_data.Config.Env;
                        var envvalue = null;
                        var is_container_already_done=false;
                        for(let envkey=0; envkey < container_envs.length; envkey++){
                            let envvariable=container_envs[envkey];
                            let k = allenvs[envkey];
                            // start 
                            let get_container_data=check_cont_exists(CONTAINER_NAME,id);
                            console.log(`get_ip_from_deleted_container(${CONTAINER_NAME},${id})`,get_container_data);
                            if(!get_container_data){
                                if(envvariable.toString().match('NOMAD_KG_OVERLAY_NETWORK') ){
                                    want_to_add = true;
                                    
                                }
                            }else{
                                is_container_already_done=true;
                            }
                            var regex=new RegExp(`${ENVKEY}=(.*)`);
                            var nomadtasknameregex=new RegExp(`NOMAD_TASK_NAME=(.*)`);
                            var nomadjobnameregex=new RegExp(`NOMAD_JOB_NAME=(.*)`);
                            if(envvalue == null){
                                envvalue=k.match(regex);
                            }
                            if(!nomad_task_name){
                                nomad_task_name=k.match(nomadtasknameregex);
                            }
                            if(!nomad_job_name){
                                nomad_job_name=k.match(nomadjobnameregex);
                            }
                            console.log("env ",k,"k.task",k.match(nomadtasknameregex), "k.job_name",k.match(nomadjobnameregex));
                            

                            if(nomad_task_name != null && nomad_job_name != null){
                                
                                nomad_task_name=nomad_task_name[1];
                                nomad_job_name=nomad_job_name[1];
                                break;
                            }

                            // end
                        }
                        
                        if(want_to_add){
                            if(nomad_job_name != null || nomad_task_name != null){
                                if(is_container_already_done){
                                    console.log("Container now already in here.");
                                }else{
                                    add_container_to_overlay(container_data,nomad_task_name,nomad_job_name);
                                    console.log(`add_container_to_overlay(container_data,${nomad_task_name},${nomad_job_name})`);
                                }
                                
                            }else{
                                console.log("Container nomad_job_name ",nomad_job_name,"Container nomad_task_name",nomad_task_name);
                            }
                        }
                    });
                }
            });
        });

    }
    if(status == 'destroy'){
        console.log("Container with id "+id+" is stoping");
        let ip_and_data=get_ip_from_deleted_container(CONTAINER_NAME,id);
        console.log(ip_and_data,"ip and data");
        if(ip_and_data != false){
            console.log("get the ip data deregster",ip_and_data);
            consul.deregister(CONTAINER_NAME).then((remove_from_consul)=>{
                console.log("now under consul.deregister with data ",remove_from_consul);
                if(remove_from_consul){
                    console.log("now under condition of consul.deregister with data ",remove_from_consul);
                    let check_delete=remove_container(CONTAINER_NAME,id);
                    if(check_delete){
                        console.log("now delete container with data ",check_delete);
                        console.log("Successfully deleted the container");
                    }else{
                        console.log("deleted the container");
                    }
                }else{
                    console.log("Delete the container",remove_from_consul);
                }

            }).catch((error)=>{
                console.log("error while deregister service",error);
            });

        }else{
            console.log("Unable to find Ip so skipping to delete");
        }

    }
}

// Listen for Docker events
docker.getEvents((err, stream) => {
    if (err) {
        console.error('Error getting Docker events:', err);
        return;
    }

    stream.on('data', (chunk) => {
        // Accumulate chunks in buffer
        buffer += chunk.toString('utf8');

        // Try to parse the buffer as JSON
        try {
            const events = buffer.split('\n');

            for (let i = 0; i < events.length - 1; i++) {
                const event = JSON.parse(events[i]);
                console.log(event.Name,event,"Name");
                handleEvent(event);
            }

            // Clear the buffer if it's successfully parsed
            buffer = events[events.length - 1];
        } catch (error) {
            if (error instanceof SyntaxError) {
                // The buffer does not contain a complete JSON object yet, so we continue accumulating
            } else {
                console.error('Error processing Docker event:', error);
            }
        }
    });

    stream.on('end', () => {
        console.log('Docker event stream ended.');
    });

    stream.on('error', (err) => {
        console.error('Docker event stream error:', err);
    });
});

console.log('Listening for Docker container events...');
