# Use an official Node.js runtime as the base image
FROM node:18

# Set the working directory inside the container
WORKDIR /usr/src/app

# Copy package.json and package-lock.json
COPY package*.json ./

RUN rm -rf node_modules package-lock.json && npm install

# Copy the rest of the application code
COPY . .

RUN chmod -R 755 /usr/src/app/node_modules

# Build the React application
RUN npm run build

# Expose the React application's port
EXPOSE 3000

# Serve the React application
CMD ["npm","start"]
