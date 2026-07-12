#!/bin/bash

echo "Starting container composition tests..."

# Wait for services to initialize
echo "Waiting for containers to become ready..."
sleep 15

# Check running containers
echo "Checking container status..."
docker compose ps

# Verify no unhealthy containers exist
if docker compose ps | grep -i "unhealthy"; then
    echo "One or more containers are unhealthy."
    exit 1
fi

# Check backend service
echo "Checking backend service..."
curl -f http://localhost:3000 || {
    echo "Backend service is not responding."
    exit 1
}

# Check frontend service
echo "Checking frontend service..."
curl -f http://localhost:8080 || {
    echo "Frontend service is not responding."
    exit 1
}

# Check MongoDB container
echo "Checking MongoDB container..."
docker compose exec -T mongo mongo --quiet --eval "db.adminCommand('ping')" || {
    echo "MongoDB service is not responding."
    exit 1
}

echo "All services are healthy and responding correctly."
exit 0