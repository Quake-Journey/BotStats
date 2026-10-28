import dgram from 'node:dgram';

// This command reports effective match overrides, unlike server cvars. Neither
// the caller nor the browser can supply a command or an RCON destination.
const COMMAND='sv otx livestatus';
export function parseLiveModes(text){
  const value=label=>{const m=new RegExp('^OTX_'+label+'\\b[^\\r\\n]*\\beffective=([01])(?:\\s|$)','m').exec(text);return m?Number(m[1]):null;};
  return {hardcore:value('HARDCORE'),training:value('TRAINING')};
}
export function readLiveModes({server,rconPassword},{timeoutMs=1800}={}){
  if(!rconPassword||/["\r\n\x00-\x1f]/.test(rconPassword))return Promise.resolve({hardcore:null,training:null});
  return new Promise(resolve=>{
    const socket=dgram.createSocket('udp4');let text='',done=false;
    const finish=()=>{if(done)return;done=true;clearTimeout(timer);try{socket.close();}catch{}resolve(parseLiveModes(text));};
    const timer=setTimeout(finish,timeoutMs);
    socket.on('error',finish);
    socket.on('message',packet=>{
      if(packet.length<10||packet.readInt32LE(0)!==-1||packet.toString('ascii',4,10)!=='print\n')return;
      if(text.length+packet.length>32768){finish();return;}
      text+=packet.toString('latin1',10).replace(/\0+$/,'');
      const modes=parseLiveModes(text);if(modes.hardcore!==null&&modes.training!==null)finish();
    });
    const colon=server.lastIndexOf(':');
    socket.connect(Number(server.slice(colon+1)),server.slice(0,colon),()=>{
      if(done)return;
      socket.send(Buffer.from('\xff\xff\xff\xffrcon "'+rconPassword+'" '+COMMAND+'\n','latin1'),error=>{if(error)finish();});
    });
  });
}

export function createModeMonitor(config,{read=readLiveModes,now=Date.now,cacheMs=1000}={}){
  let cached,last=-Infinity,pending;
  return async()=>{
    if(pending)return pending;
    if(cached&&now()-last<cacheMs)return cached;
    pending=(async()=>{
      let modes={hardcore:null,training:null};
      try{modes=await read(config);}catch{}
      // On failure do not present a previous enabled/disabled value as live.
      cached={hardcore:modes.hardcore===0||modes.hardcore===1?modes.hardcore:null,training:modes.training===0||modes.training===1?modes.training:null,checkedAt:new Date(now()).toISOString()};
      cached.state=cached.hardcore!==null&&cached.training!==null?'current':'unavailable';
      last=now();return cached;
    })();
    try{return await pending;}finally{pending=null;}
  };
}
