

async function GetLoginInfo(){
    var url = g_ws_host + '/api/';
    //获取登陆信息
    option = {"action":"get_login_info"};
    await SocketRequest(url, option, false, async function(event){
        message = JSON.parse(event.data);
        g_my_account = message.data.user_id;
        g_my_nickname = message.data.nickname;
        $("title").html(g_my_nickname);
    });
}

function GetImageFromCoolQ(name){
    var url = g_ws_host + "/api/";
    option = {
        "action": "get_image", 
        "params":{
           "file": name 
        } 
    }
    SocketRequest(url, option , false, function(res){
        console.log(JSON.parse(res.data));
    })
}

function GetContactFromCoolQ(){
    var url = g_ws_host + "/api/"
    //获取分组好友
    option = {"action":"_get_friend_list"}
    SocketRequest(url, option, false, function(event){
        var res = JSON.parse(event.data);
        if(res.status == "ok")
            myIdxDB.friend_group_list.bulkPut(res.data).catch(Dexie.BulkError, function (e) {
                //console.log(e.failures)
                console.error ("Some friend_group_list did not succeed. However, " +
                   String(res.data.length-e.failures.length) + " friend_group_list was added successfully");
            });
    });

    //获取所有好友
    option = {"action":"get_friend_list"}
    SocketRequest(url, option, false, function(event){
        var res = JSON.parse(event.data);
        if(res.status == "ok")
            myIdxDB.friend_list.bulkPut(res.data).catch(Dexie.BulkError, function (e) {
                //console.log(res.data);
                console.error ("Some friend_list did not succeed. However, " +
                   String(res.data.length-e.failures.length) + " friend_list was added successfully");
            });
    });

    //获取群组
    option = {"action":"get_group_list"}
    SocketRequest(url, option, false, async function(event){
        var res = JSON.parse(event.data);
        if(res.status == "ok"){          
            //保存到数据库
            myIdxDB.group_list.bulkPut(res.data).catch(Dexie.BulkError, function (e) {
                //console.log(res.data);
                console.error ("Some group_list did not succeed. However, " +
                   String(res.data.length-e.failures.length) + " group_list was added successfully");
            });
             //获取所有群组的群成员
/*            for(i = 0, len = res.data.length; i < len; i++){
                console.time('time_for_get_group_members');
                await RequestGroupMemberList(res.data[i].group_id);
                console.timeEnd('time_for_get_group_members');
            } */
            
        }
    });
}


//获取群组成员列表
async function RequestGroupMemberList(group_id){
    console.time('RequestGroupMemberList');
    return new Promise( async (resolve) => {
        var url = g_ws_host + "/api/"
        option = {
            "action":"get_group_member_list", 
            "params":{
                "group_id": group_id
            }
        }
        console.time('get_group_member_list');
        SocketRequest(url, option, false, async function(event){
            console.timeEnd('get_group_member_list');
            res = JSON.parse(event.data);
            if(res.status == "ok"){
                //res.data.forEach(x => {delete x.group_id});
                await SaveGroupMemberList(res.data);
            }
            console.timeEnd('RequestGroupMemberList');
            resolve();
        });
    });
}

//获取陌生人信息
async function GetStrangerInfo(user_id){
    return new Promise( (resolve) => {
        var url = g_ws_host + "/api/"
        option = {
            "action":"get_stranger_info", 
            "params":{
                "user_id": user_id
            }
        }
        SocketRequest(url, option, false, function(event){
            res = JSON.parse(event.data);
            if(res.status == "ok")
                resolve(res.data);
            else
                resolve({nickname: '[id:' + String(user_id) + ']'});
        });
    });
}

function ListenCoolQ(){
    //监听消息事件,获取消息
    url = g_ws_host + '/event/';
    SocketRequest(url, "", true, function(event){
        OnCoolQEvent(JSON.parse(event.data))
    });
}

// 处理事件
function OnCoolQEvent(data){
    if(data.post_type == "message")
        OnMessage(data);
    else if(data.post_type == "notice")
        OnNotice(data);
    else if(data.post_type == "request")
        OnRequest(data);
}