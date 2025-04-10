# add a check that the current path ends with docker-env
if [ "${PWD: -10}" != "docker-env" ]; then
    echo "Please run this script from the docker-env directory"
    exit 1
fi


docker build -t skelpy2js -f ./Dockerfile .