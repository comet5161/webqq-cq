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

async function GetUserRemark(objMsg){
    let user_remark = '[' + String(objMsg.user_id) + ']'
    if(objMsg.message_type == "private")
        if(objMsg.user_id == g_curr_session.user_id)
            user_remark = g_curr_session.user_remark;
        else
            user_remark = ( await myIdxDB.friend_list.get({user_id: objMsg.user_id}) ).remark;
    else if(objMsg.message_type == "group" || objMsg.message_type == 'discuss'){
        let chat_id = GetChatId(objMsg);
        if(chat_id == g_curr_session.chat_id){
            let str_id = String(objMsg.user_id);
            let user = g_curr_session.group_members[str_id];
            if(user != undefined)
                user_remark = user.remark;
        }
        else{
            let objInfo = await GetGroupMemberInfo(objMsg.group_id, objMsg.user_id)
            if(objInfo != undefined){
                user_remark = objInfo.card;
                if(user_remark == '')
                    user_remark = objInfo.nickname;
            }
        }
    }
    return user_remark; 
}

function CloneObj(obj){
    return JSON.parse(JSON.stringify(obj));
}


function parseCQ(msg = str){
    //img_CQ = /\[CQ:image,file=.+?\]/
    //img_url = /(?<=url=).+?(?=\])/

    //解析图片地址
    img_html = '<br><img class ="msg-img" src="$1" alt="Smiley face">'; 
    let res = msg.replace(/\[CQ:image,file=.+?,url=(.+?)\]/g, img_html) //提取图片的url,放到img_html中$1位置

    //解析表情

    //face_html = '<img class = "msg-img" src="qqFace/emoj/e$1.gif" >';
    res = res.replace(/\[CQ:face,id=([\d]+)\]/g, function(src, emoj_id){
        let id = parseInt(emoj_id);
        if(id < 100)
            id += 100;
        return '<img class = "msg-img" src="qqFace/emoj/e' + id + '.gif" >'
    });
    return res;
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

function imgShow(outerdiv, innerdiv, bigimg, _this){  
    var src = _this.attr("src");//获取当前点击的pimg元素中的src属性  
    $(bigimg).attr("src", src);//设置#bigimg元素的src属性  
  
        /*获取当前点击图片的真实大小，并显示弹出层及大图*/  
    $("<img/>").attr("src", src).on('load', function(){  
        var windowW = $(window).width();//获取当前窗口宽度  
        var windowH = $(window).height();//获取当前窗口高度  
        var realWidth = this.width;//获取图片真实宽度  
        var realHeight = this.height;//获取图片真实高度  
        var imgWidth, imgHeight;  
        var scale = 0.8;//缩放尺寸，当图片真实宽度和高度大于窗口宽度和高度时进行缩放  
          
        if(realHeight>windowH*scale) {//判断图片高度  
            imgHeight = windowH*scale;//如大于窗口高度，图片高度进行缩放  
            imgWidth = imgHeight/realHeight*realWidth;//等比例缩放宽度  
            if(imgWidth>windowW*scale) {//如宽度扔大于窗口宽度  
                imgWidth = windowW*scale;//再对宽度进行缩放  
            }  
        } else if(realWidth>windowW*scale) {//如图片高度合适，判断图片宽度  
            imgWidth = windowW*scale;//如大于窗口宽度，图片宽度进行缩放  
                        imgHeight = imgWidth/realWidth*realHeight;//等比例缩放高度  
        } else {//如果图片真实高度和宽度都符合要求，高宽不变  
            imgWidth = realWidth;  
            imgHeight = realHeight;  
        }  
                $(bigimg).css("width",imgWidth);//以最终的宽度对图片缩放  
          
        var w = (windowW-imgWidth)/2;//计算图片与窗口左边距  
        var h = (windowH-imgHeight)/2;//计算图片与窗口上边距  
        $(innerdiv).css({"top":h, "left":w});//设置#innerdiv的top和left属性  
        $(outerdiv).fadeIn("fast");//淡入显示#outerdiv及.pimg  
    });  
      
    $(outerdiv).click(function(){//再次点击淡出消失弹出层  
        $(this).fadeOut("fast");  
    });  
} 


function isScrollToBottom(elem){
    let scroll_top = elem.scrollTop();
    let height = elem.height();
    let scroll_height = elem[0].scrollHeight;
    height += parseInt( elem.css('padding-bottom') ) + parseInt( elem.css('padding-top') );
    console.log('scroll:' + (scroll_top + height) + " " + scroll_height);
    return scroll_top + height + 30 >= scroll_height;
}


function GetImageBlob(url){
    return new Promise( resolve => {
        var canvas = document.createElement('canvas');
        var img = document.createElement('img');
        img.onload = function(e) {
            canvas.width = img.width;
            canvas.height = img.height;
            var context = canvas.getContext('2d');
            context.drawImage(img, 0, 0, img.width, img.height);
            canvas.getContext('2d').drawImage(img, 0, 0, img.width, img.height);
            canvas.toBlob((blob)=>{
                resolve(blob);
            }, "image/jpeg");
        }
        img.onerror = function(e){
            console.log('error GetImageBlob!')
            resolve();
        }
        img.setAttribute("crossOrigin",'Anonymous');
        img.src = url;
    });
}
