
//创建新的webSocket连接
function SocketRequest(url, option, forever = false, callback = function(res){}){
    return new Promise( (resolve) =>{
        let socket = new WebSocket(url);
        socket.onopen = function(){
            socket.send(JSON.stringify(option));
        }

        socket.onmessage = function(res){
            if(forever == false)
                socket.close();
            callback(res);
            resolve(res);
        }

        socket.onerror = function(){
            callback("{status:'error'}");
            if(forever == false)
                socket.close();
            else
                console.error("webSocker error: " + url);
            resolve()
        }
    });
}
