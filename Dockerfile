FROM node:20
WORKDIR /usr/src/app
COPY . .

RUN npm install 

RUN cd /tmp && wget https://releases.hashicorp.com/consul/1.18.1/consul_1.18.1_linux_$(dpkg --print-architecture).zip && \
unzip consul_1.18.1_linux_$(dpkg --print-architecture).zip && cp consul /usr/local/bin/ && \
chmod +x /usr/local/bin/consul && rm -r ./consul* 

RUN chmod +x /usr/src/app/run.sh

CMD [ "sh","/usr/src/app/run.sh" ]