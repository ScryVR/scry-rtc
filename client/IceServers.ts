/**
 "* Taken from https://github.com/pradt2/always-online-stun.",
 * StunHosts.hosts is prepopulated so that if the repo ever becomes unavailable this function still has a chance of working.
 * It is recommend to call StunHosts.getHosts() before reading from StunHosts.hosts to get the most up-to-date list.
 **/
export class IceServers {
  static async getHosts() {
    try {
      const response = await fetch(
        "https://raw.githubusercontent.com/pradt2/always-online-stun/master/valid_hosts.txt"
      );
      if (response.status !== 200) {
        throw Error("Failed to fetch Stun Hosts");
      }
      const text = await response.text();
      IceServers.stunHosts = text.split("\n");
    } catch (err) {
      console.error("Failed to get updated list of Stun Hosts", err);
    }
  }

  static get servers (): Array<any> {
    return IceServers.stunHosts.map((url) => ({ urls: `stun:${url}` })).concat(IceServers.turnHosts)
  }

  static turnHosts = [
    {
      urls: "turn:openrelay.metered.ca:80",
      username: "openrelayproject",
      credential: "openrelayproject",
    },
    {
      urls: "turn:openrelay.metered.ca:443",
      username: "openrelayproject",
      credential: "openrelayproject",
    }
  ]
  static stunHosts: Array<string> = [
    "stun4.l.google.com:19305",
    "stun3.l.google.com:19305",
    "stun.geonet.ro:3478",
    "stun2.l.google.com:19305",
    "stun1.l.google.com:19302",
    "stun.ncic.com:3478",
    "stun.sipdiscount.com:3478",
    "stun.labs.net:3478",
    "stun4.l.google.com:19302",
    "stun.voipraider.com:3478",
    "stun.wtfismyip.com:3478",
    "stun.stunprotocol.org:3478",
    "stun.mobile-italia.com:3478",
    "stun.telnyx.com:3478",
    "stun.actionvoip.com:3478",
    "stun.eurosys.be:3478",
    "stun.voip.eutelia.it:3478",
    "stun.l.google.com:19302",
    "stun.gmx.net:3478",
    "stun.t-online.de:3478",
    "stun.nextcloud.com:443",
    "stun3.l.google.com:19302",
    "stun1.l.google.com:19305",
    "stun.l.google.com:19305",
    "stun.nextcloud.com:3478"
  ];
}
