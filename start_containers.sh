set -e

function st() {
  docker run --mount type=bind,source=/data/horoscope_agent,target=/usr/bin/horoscope_agent \
    -v /hs/src:/hs/src \
    -v /hs/run:/hs/run \
    --mount type=bind,source=/root/st/oj,target=/root/st/oj \
    --mount type=bind,source=/sys/fs/cgroup,target=/sys/fs/cgroup \
    --cap-add SYS_ADMIN \
    -p $1:9000 \
    -td --restart unless-stopped $2 horoscope_agent
}

mkdir -p /hs/src /hs/run
chown -R root:root /hs
chmod -R 700 /hs/run
chmod -R 755 /hs/src
chown -R root:root /root/st/oj
chmod -R 700 /root/st/oj

docker stop $(docker ps -aq) || :

st 8000 gcc
st 8001 python
st 8002 openjdk:11
st 8003 rust
st 8004 registry.cn-hangzhou.aliyuncs.com/kazune/ojcmp:1.1