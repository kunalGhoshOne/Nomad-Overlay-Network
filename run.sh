#!/bin/bash

if [ ! -d "node_modules" ]; then
  echo "node_moudles does not exist. Now installing"
  npm install --save
fi

npm run start