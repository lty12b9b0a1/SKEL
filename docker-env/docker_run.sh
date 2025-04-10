# add a check that the current path ends with docker-env
if [ "${PWD: -10}" != "docker-env" ]; then
    echo "Please run this script from the docker-env directory"
    exit 1
fi

./docker_stop.sh
docker run --name skelpy2js_container -d -t \
    --mount type=bind,source=$PWD/..,target=/workspace/ \
    skelpy2js
docker ps | grep skelpy2js_container
echo "# The container is running. To stop running the container: ./docker_stop.sh"