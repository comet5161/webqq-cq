///////////////////////////////////////////////////////////////////////////////////
// 全局变量
var g_my_account = -1;
var g_my_nickname = ""
var g_ws_host = url = 'ws://127.0.0.1:6700';
var g_curr_session = { //当前会话
    type: "", //'private' 'group' 'discuss'
    id: -1,
    type_and_id: '',
    group_members: {'user_id':{remark:''}},
    user_remark: '',
    messages: {'id': ''},
}

var g_html_body = undefined;
var g_div_msg_robot = undefined;
var g_div_msg_guest = undefined;

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
            getResponse("{status:'error'}");
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

    g_html_body = $('body').clone();
    g_div_msg_robot = $('#msg_robot').clone();
    g_div_msg_guest = $('#msg_guest').clone();
    g_div_msg_guest.removeAttr('id');
    g_div_msg_robot.removeAttr('id');

    var url = g_ws_host + '/api/';
    //获取登陆信息
    option = {"action":"get_login_info"};
    SocketRequest(url, option, false, async function(event){
        message = JSON.parse(event.data);
        g_my_account = message.data.user_id;
        g_my_nickname = message.data.nickname;
        $("title").html(g_my_nickname);
        await OpenDB("QQ_v2_" + String(g_my_account));
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



    await ShowChatList();
    initMouseListener();

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
                await GetGroupMemberList(res.data[i].group_id);
                console.timeEnd('time_for_get_group_members');
            } */
            
        }
    });


    //监听消息事件,获取消息
    url = g_ws_host + '/event/';
    SocketRequest(url, "", true, function(event){
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
        SocketRequest(url, option, false, async function(event){
            res = JSON.parse(event.data);
            //console.log(res.data[0].group_id + " len:" + res.data.length);
            if(res.status == "ok")
                //res.data.forEach(x => {delete x.group_id});
                await myIdxDB.group_list.update(group_id, {members: res.data}).catch(function (e) {
                    console.error("Group_member did not succeed.");
                    resolve();
                });
            resolve();
        });
    });
}

async function GetGroupMemberNickname(group_id){
        var idToRemark = {};
        ( await myIdxDB.group_list.get({group_id: id}) ).members
        .forEach(user =>{
            var str_id = String(user.user_id);
            if(user.card == "")
                idToRemark[str_id] = {remark: user.nickname}
            else
                idToRemark[str_id] = {remark: user.card}
        });
    return idToRemark;
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
                let title = $(this).html();
                $("#chat_title").html(title);
                StartChat(type, id);
            }
            console.log("showChatPanel");
        }
    });

    //点击联系人列表
    $("#pnl-tabs").on( 'click', 'div', function(){
        SelectPanel($(this).attr('id'));
    });

    //加载更多消息
    $('#histStart').attr('hidden', true);
    $('#histStart').click(e => {ShowMoreMessage()});

    //消息框右键菜单
    $.contextMenu({
        selector: '.msg-ball', 
        callback: function(key, options) {
            var m = "clicked: " + key + $(this).html();
            //window.console && console.log(m) || alert(m); 
        },
        items: {
            'copy': {name: "复制", icon: "copy"},
            "favor":{name: "收藏", icon: "favor",
                callback: function(itemKey, opt, e) {
                    let msg_id = $(this).parent().parent().attr('msg_id');
                    MsgAddFavor(g_curr_session.messages[msg_id]);
                }
            },
            "edit": {name: "编辑", icon: "edit"},
            'block':{name: '拦截',
                callback: function(itemKey, opt, e) {
                    let msg_id = $(this).parent().parent().attr('msg_id');
                    let strMsg = g_curr_session.messages[msg_id].message;
                    MsgAddBlock(strMsg);
                }
            },
            /*"cut": {name: "Cut", icon: "cut"},*/
            /*"paste": {name: "Paste", icon: "paste"},*/
            "delete": {name: "删除", icon: "delete"},
            "sep1": "---------",
            "quit": {name: "取消", icon: function(){
                return 'context-menu-icon context-menu-icon-quit';
            }}
        }
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
    myIdxDB.friend_group_list.each( friend_group => {
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
    myIdxDB.group_list.each( group => {
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
    var sessions = await myIdxDB.recent_session.orderBy('msg_item.time').reverse().toArray();
    var len = sessions.length;
    if(len > 0){
        parent.html("");
        var name = '';
        var id = 0;
        for(i = 0; i < len; i++){
            var item = sessions[i].msg_item;
            if(item.message_type == "group"){
                var group = await myIdxDB.group_list.get({group_id: item.group_id});
                name = group.group_name;
                id = group.group_id;
            }
            if(item.message_type == 'private'){
                var friend = await myIdxDB.friend_list.get({user_id: item.user_id});
                name = friend.remark;
                id = friend.user_id;
            }
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
    var friend_group = await myIdxDB.friend_group_list.get({friend_group_id: id});
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
            var cnt = await myIdxDB.message_unread.where({message_type:'private', user_id: id}).count();
            var txt = "+" + String(cnt);
            if(cnt <= 0)
                txt = "";
            var elem = $(`.rel-item[contact_id="${contact_id_str}"]`).find('.badge');
            elem.html(txt);
        }
        if(contact_type == "group"){
            var cnt = await myIdxDB.message_unread.where({group_id: id}).count();
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
    //$("#pnl_msgs").children('div:last').scrollIntoView();
    //pnl.css("overflow-x", "scroll");
    //pnl.scrollTop(pnl[0].scrollHeight);
    pnl.scrollTop(9e16);
    //msgs_unread.scrollIntoView();
    //msgs_unread.click();
    //msgs_end.click();
    //pnl.scrollTo("100%");
}

// 开始聊天
async function StartChat(message_type = str, id = int){
    //加载历史消息
    $("#pnl_msgs").html(''); 
    $('#histStart').attr('hidden', true);
    objMsg = {
        message_type: message_type, 
        user_id: id, 
        group_id: id, 
        discuss_id: id,
    }
    g_curr_session.type = message_type;
    g_curr_session.id = id;
    g_curr_session.type_and_id = GetTypeAndIdStr(objMsg);
    g_curr_session.messages = {};
    await ShowMessage(message_type, id);
    $('#histStart').attr('hidden', false);
}

async function ShowMessage(message_type, id){
    if(message_type == "group"){
        await GetGroupMemberList(id);
        var idToRemark = await GetGroupMemberNickname(id); //获取群成员昵称
        g_curr_session.group_members = idToRemark;
        msgs_ary = await GetNextMsgPage(message_type, id);
        msgs_ary.forEach( (msg) => {
            var str_id = String(msg.user_id);
            msg.user_remark = "[id:" + str_id + "] ";
            if(idToRemark[str_id] != undefined)
                msg.user_remark = idToRemark[str_id].remark;
            else{
/*                let res = await GetStrangerInfo(msg.user_id);
                user_remark = res.nickname;
                idToRemark[str_id] = {remark:user_remark};*/
            }
            g_curr_session.messages[String(msg.id)] = msg;
            AddMsgPrepend(CloneObj(msg));
            ScrollToBottom();
        });
        ScrollToBottom();
    }
    else if(message_type == "private"){
        var user_remark = ( await myIdxDB.friend_list.get({user_id: id}) ).remark;
        g_curr_session.user_remark = user_remark;
        msgs_ary = await GetNextMsgPage(message_type, id);
        msgs_ary.forEach( (msg) => {
            msg.user_remark = user_remark;
            g_curr_session.messages[String(msg.id)] = msg;
            AddMsgPrepend(CloneObj(msg));
            ScrollToBottom();
        });
        ScrollToBottom();
    }
    else if(message_type == "discuss"){

    }
    //$('#pnl_msgs').css('overflow', 'auto');//恢复滚动条
}


async function ShowMoreMessage(){
    msgs_ary = await GetNextMsgPage();
    cnt = msgs_ary.length;
    let idToRemark = g_curr_session.group_members;
    let first_msg = $('#pnl_msgs').children(':first');
    let offset = $('#pnl_show').offset().top - $('#histStart').offset().top
    msgs_ary.forEach((msg) => {
        var str_id = String(msg.user_id);
        msg.user_remark = "[id:" + str_id + "] ";
        if(idToRemark[str_id] != undefined)
            msg.user_remark = idToRemark[str_id].remark;
        else{
/*                let res = await GetStrangerInfo(msg.user_id);
            user_remark = res.nickname;
            idToRemark[str_id] = {remark:user_remark};*/
        }
        g_curr_session.messages[String(msg.id)] = msg;
        AddMsgPrepend(CloneObj(msg));
    });
    //let padding_top = parseInt( $('#pnl_show').css('padding').split(' ')[0] );
    let top = first_msg.position().top - $('#histStart').height() + offset;
    $('#pnl_show').scrollTop(top);
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
        objMsg = {
            user_id: g_my_account, 
            user_remark: '', 
            message: SendMsgDispose(text.value),
            time: Date.now()/1000
        }
        AddMsg(objMsg);
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
function AddMsg(objMsg, isUnread = false, prepend = false)
{
    var t = new Date(objMsg.time*1000 + 8*3600*1000); //转换成北京时间
    str_time = t.toJSON().substr(0, 19).replace('T', ' ');
    //str_time = str_time.substr(0, 10) + " " + str_time.substr(11, 8); 
    objMsg.user_remark += ' [' + str_time + ']';

    objMsg.message = parseCQ(objMsg.message);
    var msg = CreateMsg(objMsg);
    if(isUnread)
        msg.attr("read", false);
    msg.attr('msg_id', objMsg.id);
    if(prepend == false)
        $("#pnl_msgs").append(msg);
    else
        $("#pnl_msgs").prepend(msg); //在子元素头部添加



}

// 在最前面增加信息
function AddMsgPrepend(objMsg)
{
    AddMsg(objMsg, false, true);
}

// 生成内容
function CreateMsg(objMsg)
{
    parent = $("#msg_list")
    let elem = ""
    img_url = 'http://q.qlogo.cn/headimg_dl?dst_uin=' + String(objMsg.user_id) + '&spec=100';
    img_style = `url(${img_url})`;
    if(objMsg.user_id == g_my_account)
    {
        elem = g_div_msg_guest.clone();
        elem.find(".msg-ball").html(objMsg.message);
        elem.find(".msg-right").attr("user_remark", objMsg.user_remark);
        elem.find(".msg-host").css("background-image", img_style);
        //elem.attr("id", "msg_guest_display");
        elem.removeAttr("hidden");
        //elem.attr("hidden", false);
    }
    else
    {
        elem = g_div_msg_robot.clone()
        elem.find(".msg-ball").html(objMsg.message); 
        elem.find(".msg-left").attr("user-remark", objMsg.user_remark)
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

function GetTypeAndIdStr(objMsg){
    var type_and_id = objMsg.message_type + "_";
    if(objMsg.message_type == 'private')
        type_and_id += String(objMsg.user_id);
    if(objMsg.message_type == 'group')
        type_and_id += String(objMsg.group_id);
    if(objMsg.message_type == 'discuss')
        type_and_id += String(objMsg.discuss_id);
    return type_and_id;
}

//处理聊天消息
async function OnMessage(objMsg){

    if( (await FilterMessage(objMsg)) == true)
        return;

    delete objMsg.sender; //sender信息无需每次都保存。
    await SaveMessage(objMsg);

    myIdxDB.message_unread.put(objMsg).then( ()=>{
        ShowUnreadMsgNum();
    });
    

    var type_and_id = GetTypeAndIdStr(objMsg);
    myIdxDB.recent_session.put({
        type_and_id: type_and_id,
        msg_item: objMsg
    })

    //将消息添加到当前聊天窗口
    if(type_and_id == g_curr_session.type_and_id){
        objMsg.user_remark = String(objMsg.user_id);
        if(objMsg.message_type == "private")
            objMsg.user_remark = g_curr_session.user_remark;
        else if(objMsg.message_type == "group" || objMsg.message_type == 'discuss'){
            let str_id = String(objMsg.user_id);
            let user = g_curr_session.group_members[str_id];
            if(user != undefined)
                objMsg.user_remark = user.remark;
        } 
        g_curr_session.messages[String(objMsg.id)] = objMsg;
        AddMsg(CloneObj(objMsg), true);
    }

    //debug
    var str = ""
    if(objMsg.message_type == "group"){
        str = String(objMsg.group_id);
    }
    str = str + " " + objMsg.user_remark + " ";
    var new_date = new Date();
    new_date.setTime(objMsg.time*1000);
    console.log(new_date.toLocaleTimeString() + " " + objMsg.post_type);
    console.log(str + " " +objMsg.message);

}

function OnPrivateMessage(){

}

function OnGroupMessage(){

}

function OnDiscussMessage(){

}

function OnNotice(data){
    myIdxDB.notice.put(data);
}

function OnRequest(data){
    myIdxDB.request.put(data);

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