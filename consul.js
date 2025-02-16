
var consul  = {};
const { execSync } = require('child_process'); 



function executeCommandWithRetry(command, maxAttempts = 3) {
  let output;
  let error;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      // Execute the command
      const result = execSync(command, {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'inherit']
      });

      // Handle successful execution
      output = result;
      console.log(`Command executed successfully on attempt ${attempt}`);
      return JSON.stringify({ status: true, output });
    } catch (error) {
      // Handle errors
      if(error.status === 0){
        return JSON.stringify({ status: true, output });
      }else{
        console.error(`Attempt ${attempt} failed:`, error.message);
      
        // Check if we've reached the maximum attempts
        if (attempt >= maxAttempts) {
          // Return error JSON with status false
          return JSON.stringify({ status: false, error: error.message });
        }
      }
     
    }
  }
}


// // consul deregister
 consul.deregister = (containername)=>{
    return new Promise((resolve, reject) => {
      var output = executeCommandWithRetry("consul services deregister -id="+containername);
      output = JSON.parse(output);
      if(output.status == true){
        resolve(output);
      }else{
        reject(output);
      }
    });

  }

// // consul register 
consul.register = (appname,containername,address)=>{
    return new Promise((resolve, reject) => {
      // var output = executeCommandWithRetry("consul services register -name="+appname+" -address="+address);
      var output = executeCommandWithRetry("consul services register -id="+containername+" -name="+appname+" -address="+address);
      if(output.status == true){
        resolve(output);
      }else{
        reject(output);
      }
    });
  }

consul.list_all_services = ()=>{
  return new Promise((resolve, reject) => {
    
    request.get(url).then((data)=>{
      if(data.length != 0){
        resolve(data);
      }else{
        resolve([]);
      }
    });
  })
}

consul.get_service_by_name = (service_name)=>{
  return new Promise((resolve, reject) => {
    consul.list_all_services().then((data)=>{
      if(data.length > 0){
        if(data[service_name] != undefined){
            let consul_service_url=process.env.CONSUL_URL;
            let url=consul_service_url+"/v1/catalog/service/"+service_name+"?node="+current_node_name;
          request.get(url).then((data)=>{
            
            resolve(data);

          }).catch((err)=>{
            reject(err);
          });
        }else{
          reject([]);
        }
      }else{

      }
    }).catch((err)=>{
      reject(err);
    });
  });
}

consul.get_specifc_record_of_service=(service_name,uuid)=>{

  consul.get_service_by_name(service_name).then((service)=>{
    for (k in service){
      if(service[k].ServiceID.toString().includes(uuid) ){
        resolve({"id":service[k].ServiceID,"ip":service[k].ServiceAddress});
        break;
      }
    }
    reject(null);
  }).catch((err)=>{
    reject(err);
  });

}





module.exports = consul;