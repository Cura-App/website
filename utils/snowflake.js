let cluster = require("cluster");
let inc = 0,
  lastSnowflake,
  epoch = 1621813111265;
module.exports = {
  getCluster(){
      if(cluster.worker) return cluster.worker.id;
      return 0;
  },

  createSnowFlake() {
    const msSince = (new Date().getTime() - epoch)
      .toString(2)
      .padStart(42, "0");
    const pid = process.pid.toString(2).slice(0, 5).padStart(5, "0");
    const wid = this.getCluster()
      .toString(2)
      .slice(0, 5)
      .padStart(5, "0");
    const getInc = (add) => (inc + add).toString(2).padStart(12, "0");

    let snowflake = `0b${msSince}${wid}${pid}${getInc(0)}`;
    snowflake === lastSnowflake
      ? (snowflake = `0b${msSince}${wid}${pid}${getInc(1)}`)
      : (inc = 0);

    lastSnowflake = snowflake;
    return BigInt(snowflake).toString();
  },
};