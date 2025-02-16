# Nomad Overlay Network Manager

## Overview
Nomad Overlay Network Manager is a lightweight service designed to enable seamless cross-host communication for Docker containers running on Nomad. It resolves a key limitation in Nomad, where containers across different hosts cannot communicate directly. By leveraging Docker Swarm's attachable overlay network and Consul's DNS-based service discovery, this tool ensures automatic container registration and deregistration.

## Features
- **Automatic Network Attachment**: Monitors new Docker containers and attaches them to the `my-attachable-overlay` network if they have `NOMAD_KG_OVERLAY_NETWORK=true` set as an environment variable.
- **Consul DNS Registration**: Retrieves container configuration and registers the container in Consul for easy DNS-based service discovery.
- **Automatic Cleanup**: Detects when a container is deleted and removes its corresponding DNS record from Consul.
- **Fixes Nomad's Cross-Host Communication Issue**: Enables direct communication between Nomad-deployed containers across different hosts.

## Prerequisites
Before using this tool, ensure you have the following:
- Docker Swarm initialized with an attachable overlay network named `my-attachable-overlay`
- A running Consul instance for service registration
- Nomad as the container orchestrator

## Deployment
### Using Docker Compose
Create a `docker-compose.yml` file (example provided below):

```yaml
version: '3'
services:
  manager:
    image: kunalghoshone/nomad-overlay-network:latest
    volumes:
      - ./containers:/containers
      - /var/run/docker.sock:/var/run/docker.sock
    environment:
      - CONSUL_HTTP_ADDR=192.168.62.101:8500
      - CONSUL_URL=http://192.168.62.101:8500/
      - ENV_KEY_TO_CHECK=NOMAD_KG_OVERLAY_NETWORK
      - IS_CONTROLLER=false
      - OVERLAY_DOCKER_SWARM_NETWORK_NAME=my-attachable-overlay
```

### Running as a Standalone Container
You can also run the manager directly using Docker:
```sh
docker run -d \
  -v /var/run/docker.sock:/var/run/docker.sock \
  -e CONSUL_HTTP_ADDR=192.168.62.101:8500 \
  -e CONSUL_URL=http://192.168.62.101:8500/ \
  -e ENV_KEY_TO_CHECK=NOMAD_KG_OVERLAY_NETWORK \
  -e IS_CONTROLLER=false \
  -e OVERLAY_DOCKER_SWARM_NETWORK_NAME=my-attachable-overlay \
  kunalghoshone/nomad-overlay-network:latest
```

## How It Works
1. The manager listens for Docker container events via `docker.sock`.
2. When a new container is created:
   - It checks if the container has `NOMAD_KG_OVERLAY_NETWORK=true` set.
   - If true, it retrieves the container's configuration.
   - The container is attached to the `my-attachable-overlay` network.
   - The container's details are registered in Consul's DNS system.
3. When a container is removed:
   - The manager detects its deletion.
   - It removes the corresponding DNS record from Consul.

## Troubleshooting
### Consul Registration Not Working
- Ensure Consul is running and accessible at `CONSUL_HTTP_ADDR`.
- Check if the container metadata is being retrieved correctly.

### Containers Not Communicating Across Hosts
- Verify that `my-attachable-overlay` exists and is attachable (`docker network ls`).
- Ensure Docker Swarm is properly configured.
- Confirm that Nomad is correctly launching containers with the required environment variable.

## License
This project is open-source and available under the MIT License.

## Contributions
Contributions are welcome! Feel free to submit issues or pull requests.

## Contact
For any questions or support, reach out via GitHub issues or the development community.

