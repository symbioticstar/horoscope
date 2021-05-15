set -e

function st() {
  docker run --mount type=bind,source=/data/horoscope_fair,target=/usr/bin/horoscope_fair \
    --mount type=bind,source=/data/horoscope_lantern,target=/usr/bin/horoscope_lantern \
    -v /hs/src:/hs/src \
    -v /hs/run:/hs/run \
    --mount type=bind,source=/root/st/oj,target=/root/st/oj \
    --mount type=bind,source=/sys/fs/cgroup,target=/sys/fs/cgroup \
    --cap-add ALL \
    -p $1:9000 \
    -td --restart unless-stopped $2 sh -c 'horoscope_fair 9000 /usr/bin/horoscope_lantern'
    # must use sh -c '...', must not run binary directly
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