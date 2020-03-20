///////////////////////////////////////////////////////////////////////////////////
// 消息格式解析


function GetChatId(msg = {message_type:'', user_id:0, group_id:0, discuss_id:0}){
    if(msg.message_type == 'private')
        return 1e15 + msg.user_id;
    if(msg.message_type == 'group')
        return 2e15 + msg.group_id;
    if(msg.message_type == 'discuss')
        return 3e15 + msg.discuss_id;
}

function CloneObj(obj){
    return JSON.parse(JSON.stringify(obj));
}


function parseCQ(msg = str){
  //img_CQ = /\[CQ:image,file=.+?\]/
  //img_url = /(?<=url=).+?(?=\])/

  //解析图片地址
  img_html = '<br><img class ="msg-img" src="$1" alt="Smiley face">'; 
  return msg.replace(/\[CQ:image,file=.+?,url=(.+?)\]/g, img_html) //提取图片的url,放到img_html中$1位置
}

//消息过滤

async function FilterMessage(msg){
    let res = false;
    let chat_id = GetChatId(msg);

/*    let storage = window.localStorage;
    let str_filter = "filter_" + g_my_account;
    let filter = storage.getItem(str_filter);*/
    //
    res = res || BlockRepeator(msg.message, chat_id);

    res = res || await CheckMessageBlocked(msg.message);

    return res;
}

//屏蔽复读
let recent_msgs = {};
function BlockRepeator(message, chat_id){
    let res = false;
    if(recent_msgs[String(chat_id)] == undefined)
        recent_msgs[String(chat_id)] = Array();
    let queue = recent_msgs[String(chat_id)];
    if(queue.indexOf(message) > -1){
        res = true;
        
        console.log('屏蔽复读:' + message);
    }
    queue.push(message);
    if(queue.length > 3){
        queue.shift();
    }
    return res;
}

