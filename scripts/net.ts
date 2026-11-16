// Some networks refuse to look up the database's address. For scripts run from this computer,
// look names up through public DNS servers when the normal lookup fails.
import dns from 'node:dns';
import { Agent, setGlobalDispatcher } from 'undici';

const resolver = new dns.Resolver();
resolver.setServers(['8.8.8.8', '1.1.1.1']);

setGlobalDispatcher(new Agent({
  connect: {
    autoSelectFamily: false,
    timeout: 30000,
    lookup(hostname, options, callback) {
      dns.lookup(hostname, options, (err, address, family) => {
        if (!err) return callback(null, address as never, family as never);
        resolver.resolve4(hostname, (err2, addresses) => {
          if (err2 || !addresses.length) return callback(err, address as never, family as never);
          if ((options as { all?: boolean }).all) callback(null, addresses.map((a) => ({ address: a, family: 4 })) as never, undefined as never);
          else callback(null, addresses[0] as never, 4 as never);
        });
      });
    },
  },
}));
