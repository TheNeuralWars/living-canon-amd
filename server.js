// Local/container server (same handlers as Vercel functions)
const http=require('http'),fs=require('fs'),path=require('path');const ep=require('./api/episode'),hl=require('./api/health');
http.createServer((req,res)=>{res.status=c=>(res.statusCode=c,res);res.json=o=>{res.setHeader('Content-Type','application/json');res.end(JSON.stringify(o))};
 if(req.url.startsWith('/api/health'))return hl(req,res);
 if(req.url.startsWith('/api/episode')){let b='';req.on('data',d=>b+=d);req.on('end',()=>{req.body=b;ep(req,res)});return}
 res.setHeader('Content-Type','text/html');res.end(fs.readFileSync(path.join(__dirname,'public/index.html')));
}).listen(process.env.PORT||3000,()=>console.log('http://localhost:'+(process.env.PORT||3000)));
