///////////////////////////////////////////////////////////////////////////////////
// 全局变量
var g_my_account = -1;
var g_my_nickname = ""
var g_ws_host = url = 'ws://127.0.0.1:6700';
var g_curr_seccion = { //当前会话
    type: "", //'private' 'group' 'discuss'
    id: -1,
    group_members: {'user_id':{remark:''}},
    user_remark: ''
}

//创建新的webSocket连接
function SocketRequest(url, option, forever = false, getResponse = function(res){}){
    return new Promise( (resolve) =>{
        let socket = new WebSocket(url);
        socket.onopen = function(){
            socket.send(JSON.stringify(option));
        }

        socket.onmessage = function(res){
            if(forever == false)
                socket.close();
            getResponse(res);
            resolve(res);
        }

        socket.onerror = function(){
            if(forever == false)
                socket.close();
            else
                console.error("webSocker error: " + url);
            resolve()
        }
    });
}

///////////////////////////////////////////////////////////////////////////////////
// 窗体事件

$(document).ready( function(){

    var url = g_ws_host + '/api/';
    //获取登陆信息
    option = {"action":"get_login_info"};
    SocketRequest(url, option, false, async function(event){
        message = JSON.parse(event.data);
        g_my_account = message.data.user_id;
        g_my_nickname = message.data.nickname;
        $("title").html(g_my_nickname);
        await OpenDB("QQ_" + String(g_my_account));
        Init();
    });
});

//监听刷新和关闭事件
window.onbeforeunload = function(){
    console.log("onbeforeunload");
}

///////////////////////////////////////////////////////////////////////////////////
//初始化
async function Init(){

    ShowChatList();
    initMouseListener();

    var url = g_ws_host + "/api/"
    //获取分组好友
    option = {"action":"_get_friend_list"}
    await SocketRequest(url, option, false, function(event){
        var res = JSON.parse(event.data);
        if(res.status == "ok")
            QQ_db.friend_group_list.bulkPut(res.data).catch(Dexie.BulkError, function (e) {
                //console.log(e.failures)
                console.error ("Some friend_group_list did not succeed. However, " +
                   String(res.data.length-e.failures.length) + " friend_group_list was added successfully");
            });
    });

    //获取所有好友
    option = {"action":"get_friend_list"}
    await SocketRequest(url, option, false, function(event){
        var res = JSON.parse(event.data);
        if(res.status == "ok")
            QQ_db.friend_list.bulkPut(res.data).catch(Dexie.BulkError, function (e) {
                //console.log(res.data);
                console.error ("Some friend_list did not succeed. However, " +
                   String(res.data.length-e.failures.length) + " friend_list was added successfully");
            });
    });

    //获取群组
    option = {"action":"get_group_list"}
    await SocketRequest(url, option, false, function(event){
        var res = JSON.parse(event.data);
        if(res.status == "ok"){
             //获取所有群组的群成员
            for(i = 0, len = res.data.length; i < len; i++){
                GetGroupMemberList(res.data[i].group_id);
            }           
            //保存到数据库
            QQ_db.group_list.bulkPut(res.data).catch(Dexie.BulkError, function (e) {
                //console.log(res.data);
                console.error ("Some group_list did not succeed. However, " +
                   String(res.data.length-e.failures.length) + " group_list was added successfully");
            });
        }
    });


    //监听消息事件,获取消息
    url = g_ws_host + '/event/';
    await SocketRequest(url, "", true, function(event){
        OnEvent(JSON.parse(event.data))
    });

    initPropChangeListener();

}

function initPropChangeListener(){
    //$(".msg robot");
}

//获取群组成员列表
async function GetGroupMemberList(group_id){
    return new Promise( async (resolve) => {
        var url = g_ws_host + "/api/"
        option = {
            "action":"get_group_member_list", 
            "params":{

                "group_id": group_id
            }
        }
        await SocketRequest(url, option, false, async function(event){
            res = JSON.parse(event.data);
            console.log(res.data[0].group_id + " len:" + res.data.length);
            if(res.status == "ok")
                await QQ_db.group_member_list.bulkPut(res.data).catch(Dexie.BulkError, function (e) {
                    console.error ("Some group_member_list did not succeed. However, " +
                       String(res.data.length-e.failures.length) + " group_member_list was added successfully");
                });
            resolve();
        });
    });
}

////////////////////////////////////////////////////////////////////////////////////
//鼠标事件

function initMouseListener(){
    //点击联系人，开始聊天
    $("ul#contact_list").delegate('li','click', function(e){
        if(e.target == e.currentTarget) //防止子元素响应后，父元素重复响应。
        {
            type = $(this).attr("contact_type");
            id = $(this).attr("contact_id");
            id = parseInt(id);
            if(type == "friend_group"){
                friend_group_elem = $(this);
                showFriendsInGroup(friend_group_elem);
            }
            else{
                StartChat(type, id);
            }
            console.log("showChatPanel");
        }
    });

    //点击联系人列表
    $("#pnl-tabs").on( 'click', 'div', function(){
        SelectPanel($(this).attr('id'));
    });
}

function SelectPanel(id){
    $(".tab-btn").each( function(){
        $(this).attr('class', 'tab-btn');
    });
    $("#" + id).attr('class', 'tab-btn active');
    switch(id){
        case "contact_tab_chat":
            console.log("log: ShowChatList");
            ShowChatList();
            break;
        case "contact_tab_friends":
            console.log("log: ShowFriendList");
            ShowFriendList();
            break;
        case "contact_tab_groups":
            ShowGroupList();
            console.log("log: ShowGroupList");
            break;
    }
}

////////////////////////////////////////////键盘事件////////////////////////////////

// 按Enter键发送信息
$(document).keydown(function(event){
    if(event.keyCode == 13 && window.event.ctrlKey){
        SendMsg();
    }
});


//////////////////////////////////////////////////////////////////////////////////////////////////////
//显示联系人列表

function ShowFriendList(){
    var parent = $("#contact_list");
    //parent.children("div:gt(1)").remove();
    var elem = parent.children("li:first");
    parent.html("");
    parent.attr('unfolded', 'false');
    QQ_db.friend_group_list.each( friend_group => {
        elem.html( "+ " + friend_group.friend_group_name);
        elem.attr("contact_type", "friend_group");
        elem.attr("contact_id", friend_group.friend_group_id);
        parent.append(elem.clone());
    });
}

function ShowGroupList(){
    var parent = $("#contact_list");
    var elem = parent.children("li:first");
    parent.html("");
    QQ_db.group_list.each( group => {
        elem.html(group.group_name);
        elem.attr("contact_type", "group");
        elem.attr("contact_id", group.group_id);
        parent.append(elem.clone());
    });
}

//显示会话列表
async function ShowChatList(){
    var parent = $("#contact_list");
    var elem = parent.children("li:first");
    var sessions = await QQ_db.recent_session.orderBy('msg_item.time').reverse().toArray();
    var len = sessions.length;
    console.log('session len = ' + len)
    t = new Date();
    if(len > 0){
        parent.html("");
        var name = '';
        var id = 0;
        for(i = 0; i < len; i++){
            console.log(i + " " + sessions[i].type_and_id);
            var item = sessions[i].msg_item;
            if(item.message_type == "group"){
                var group = await QQ_db.group_list.get({group_id: item.group_id});
                name = group.group_name;
                id = group.group_id;
            }
            if(item.message_type == 'private'){
                var friend = await QQ_db.friend_list.get({user_id: item.user_id});
                name = friend.remark;
                id = friend.user_id;
            }
            console.log("chat:"+name);
            elem.html(name + '<a class ="badge"></a>');
            elem.attr("contact_type", item.message_type);
            elem.attr("contact_id", String(id));
            elem.attr("title", (new Date(item.time*1000)).toTimeString().substr(0,8));
            parent.append(elem.clone());
        }
    }
    ShowUnreadMsgNum();
}

//显示组内好友
async function showFriendsInGroup(friend_group_elem){
    id = parseInt( friend_group_elem.attr("contact_id") );
    var friend_group = await QQ_db.friend_group_list.get({friend_group_id: id});
    var friends = friend_group.friends;
    len = friends.length;

    var unfolded = friend_group_elem.attr('unfolded');
    if(unfolded != 'true'){
        friend_group_elem.attr('unfolded', 'true');
        friend_group_elem.html( "- " + friend_group.friend_group_name);
        //var elem = friend_group_elem.clone();
        var elem = $('<li></li>')
        elem.attr('contact_type', "private");
        for(i = 0; i < len; i++){
            elem.attr('contact_id', friends[i].user_id);
            elem.html('&ensp;&ensp;&ensp;' + friends[i].remark)
            friend_group_elem.append(elem.clone());
        }
    }
    else{
        friend_group_elem.attr('unfolded', 'false');
        friend_group_elem.html( "+ " + friend_group.friend_group_name);
    }
}

//显示未读消息数量

function ShowUnreadMsgNum(){
    $('.rel-item').each(async function(){
        var contact_type = $(this).attr('contact_type');
        var contact_id_str = $(this).attr('contact_id');
        var id = parseInt(contact_id_str);
        if(contact_type == "private"){
            var cnt = await QQ_db.message_unread.where({message_type:'private', user_id: id}).count();
            var txt = "+" + String(cnt);
            if(cnt <= 0)
                txt = "";
            var elem = $(`.rel-item[contact_id="${contact_id_str}"]`).find('.badge');
            elem.html(txt);
        }
        if(contact_type == "group"){
            var cnt = await QQ_db.message_unread.where({group_id: id}).count();
            var txt = "+" + String(cnt);
            if(cnt <= 0)
                txt = "";
            var elem = $(`.rel-item[contact_id="${contact_id_str}"]`).find('.badge');
            elem.html(txt);
        }

    })
}

function ScrollToBottom(){
    var pnl = $("#pnl_show");
    //pnl.css("overflow-x", "scroll");
    pnl.scrollTop(pnl[0].scrollHeight);
    //pnl.scrollTo("100%");
}

// 开始聊天
async function StartChat(message_type = str, id = int){
    //加载历史消息
    $("#msgs").children("div:gt(2)").remove(); //不删除前两个元素
    //$("#msgs").attr("hidden", true);
    var pnl = $('#msgs');
    //pnl.animate({scrollTop:pnl.height()}, 500);
    pnl.on("resize", ScrollToBottom);
    filter = {message_type: message_type};
    if(message_type == "group"){
        //await GetGroupMemberList(id);
        filter = {group_id:id};
        //获取群成员昵称
        var members = {};
        await QQ_db.group_member_list.where({group_id: id}).each( (user) => {
            var str_id = String(user.user_id);
            if(user.card == "")
                members[str_id] = {remark: user.nickname}
            else
                members[str_id] = {remark: user.card}
        });
        g_curr_seccion.group_members = members;
        var iter = {cnt:0}
        var resCollection = QQ_db.message_unread.where({group_id:id});
        var cnt = await resCollection.count();
        //resCollection = resCollection.offset(cnt - 200);
        await resCollection.each( (msg, cursor) => {
            var str_id = String(msg.user_id);
            var user_remark = members[str_id].remark;
            AddMsg(msg.user_id, msg.message, user_remark, msg.time);
            iter.cnt += 1;
            //if(iter.cnt % 10 == 0)
                ScrollToBottom();
        });
        //ScrollToBottom();
        //$("#msgs").attr("hidden", false);
    }
    else if(message_type == "private"){
        filter.user_id = id;
        var user_remark = ( await QQ_db.friend_list.get({user_id: id}) ).remark;
        g_curr_seccion.user_remark = user_remark;
        var resCollection = QQ_db.message.where(filter);
        var cnt = await resCollection.count();
        resCollection = resCollection.offset(cnt - 200); //只获取最新的1000个消息
        resCollection.each( msg => {
            AddMsg(msg.user_id, msg.message, user_remark, msg.time);
            ScrollToBottom();
        });
    }
    else if(message_type == "discuss"){
        // filter.discuss_id = id;
        // QQ_db.message.where(filter).each( async msg => {
        //     var user_remark = await QQ_db.group_member_list.get({group_id: id, user_id: msg.user_id});
        //     AddMsg(msg.user_id, msg.message, user_remark);
        // });
    }
    g_curr_seccion.type = type;
    g_curr_seccion.id = id;
}

// 发送信息
function SendMsg()
{
    var text = document.getElementById("text");
    if (text.value == "" || text.value == null)
    {
        alert("发送信息为空，请输入！")
    }
    else
    {
        AddMsg(g_my_account, SendMsgDispose(text.value), "",  Date.now()/1000);
        //var retMsg = AjaxSendMsg(text.value)
        text.value = "";
    }
}
// 发送的信息处理
function SendMsgDispose(detail)
{
    detail = detail.replace("\n", "<br>").replace(" ", "&nbsp;")
    return detail;
}

// 增加信息
function AddMsg(user_id, content, user_remark, timeStm, isLatest = false)
{
    var t = new Date(timeStm*1000 + 8*3600*1000); //转换成北京时间
    str_time = t.toJSON().substr(0, 19).replace('T', ' ');
    //str_time = str_time.substr(0, 10) + " " + str_time.substr(11, 8); 
    user_remark += ' [' + str_time + ']';

    content = parseCQ(content);
    var msg = CreadMsg(user_id, content, user_remark);
    if(isLatest)
        msg.attr("read", false);
    $("#msgs").append(msg.clone());
    //$("#msgs").prepend(msg.clone()); //在子元素头部添加
}

// 生成内容
function CreadMsg(user_id, content, user_remark)
{
    parent = $("#msg_list")
    var elem = ""
    img_url = 'http://q.qlogo.cn/headimg_dl?dst_uin=' + String(user_id) + '&spec=100';
    img_style = `url(${img_url})`;
    if(user_id == g_my_account)
    {
        elem = $("#msg_guest").clone();
        elem.find(".msg-ball").html(content);
        elem.find(".msg-right").attr("user_remark", user_remark);
        elem.find(".msg-host").css("background-image", img_style);
        //elem.attr("id", "msg_guest_display");
        elem.removeAttr("hidden");
        //elem.attr("hidden", false);
    }
    else
    {
        elem = $("#msg_robot") .clone()
        elem.find(".msg-ball").html(content); 
        elem.find(".msg-left").attr("user-remark", user_remark)
        //elem.attr("id", "msg_robot_display"); 
        elem.find(".msg-host").css("background-image", img_style);
        //elem.find(".msg-host").attr("style", img_style);
        elem.removeAttr('hidden')
        //elem.attr("hidden", false);
        //*[@id="msg_robot_display"]/div/div[1]
    }
    return elem;
}



/////////////////////////////////////////////////////////////////////// 后台信息处理 /////////////////////////////////////////////////////////////////////////////////

// 发送
function AjaxSendMsg(_content)
{
    var retStr = "";
    $.ajax({
        type: "POST",
        async:false,
        url: "/Home/ChatMethod/",
        data: {
            content: _content
        },
        error: function (request) {
            retStr = "你好";
        },
        success: function (data) {
            retStr = data.info;
        }
    });
    return retStr;
}

// 处理事件
function OnEvent(data){
    if(data.post_type == "message")
        OnMessage(data);
    else if(data.post_type == "notice")
        OnNotice(data);
    else if(data.post_type == "request")
        OnRequest(data);
}

//处理聊天消息
async function OnMessage(data){
    delete data.sender; //sender信息无需每次都保存。

    //
    QQ_db.message.put(data);
    QQ_db.message_unread.put(data);
    var type_and_id = data.message_type + "_";
    if(data.message_type == 'private')
        type_and_id += String(data.user_id);
    if(data.message_type == 'group')
        type_and_id += String(data.group_id);
    if(data.message_type == 'discuss')
        type_and_id += String(data.discuss_id);
    //await QQ_db.recent_session.where({type_and_id:type_and_id}).delete();
    QQ_db.recent_session.put({
        type_and_id: type_and_id,
        msg_item: data
    })
    //type_and_id, latest_time, user_id, group_id, message_type, latest_msg, latest_msg_id

    //将消息添加到当前聊天窗口
    if(data.message_type == g_curr_seccion.type){
        if(data.message_type == "private" && data.user_id == g_curr_seccion.id){
            AddMsg(data.user_id, data.message, 
                g_curr_seccion.user_remark, data.time, true);
        }
        else if(data.message_type == "group" && data.group_id == g_curr_seccion.id){
            str_id = String(data.user_id);
            AddMsg(data.user_id, data.message, 
                g_curr_seccion.group_members[str_id].remark, data.time, true);
        }
        else if(data.message_type == "discuss" && data.discuss_id == g_curr_seccion.id){
            str_id = String(data.user_id);
            AddMsg(data.user_id, data.message, 
                g_curr_seccion.group_members[str_id].remark, data.time, true);
        }
    }
    ShowUnreadMsgNum();

    //debug
    var str = ""
    if(data.message_type == "group"){
        str = String(data.group_id);
    }
    str = str + " " + String(data.user_id) + " ";
    var new_date = new Date();
    new_date.setTime(data.time*1000);
    console.log(new_date.toLocaleTimeString() + " " + data.post_type);
    console.log(str + " " +data.message);

}

function OnPrivateMessage(){

}

function OnGroupMessage(){

}

function OnDiscussMessage(){

}

function OnNotice(data){
    QQ_db.notice.put(data);
}

function OnRequest(data){
    QQ_db.request.put(data);

}

/*// 获取联系人
function GetFriendList(host)
{
    var retStr = "";
    url = host + "/get_friend_list";
    $.ajax({
        type: 'post',
        //dataType: 'jsonp',  // 请求方式为jsonp
        //crossDomain: true,
        async:false,
        url: url,
        error: function(res){
            retStr = "error";
        },
        success: function(data){
            retStr = data;
        }
    })
    return retStr;
}*/