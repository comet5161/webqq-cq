
function WaitForJudge( judge, func, times, interval) {
    var _times = times || 100, //100次
    _interval = interval || 50, //20毫秒每次 
    _iIntervalID; //定时器id
    if( judge() ){ //如果已经获取到了，就直接执行函数
        func && func.call();
    } else {
        _iIntervalID = setInterval(function() {
            if(_times <= 0) {
                clearInterval(_iIntervalID);
            }
            _times--;
            if( judge() ) { //判断是否取到
                func && func.call();
                clearInterval(_iIntervalID);
            }
        }, _interval);
    }
}

function BackupPage(){
    if(g_my_account > 0){
        let storage = window.localStorage;
        let scrollTop = $('#pnl_show').scrollTop();
        storage['scrollTop'] = scrollTop;
        storage['scrollHeight'] = $('#pnl_show')[0].scrollHeight;
        storage['curr_session'] = JSON.stringify(g_curr_session);

        //$('#pnl_show').ready(function(){$('#pnl_show').scrollTop(scrollTop);});
        window.localStorage['html_body'] = $('body').html();
    }
    else{
        storage.clear();
    }
}

function RestorePage(){
    let storage = window.localStorage;
    
    if(storage['curr_session'] != undefined){
        let obj = JSON.parse( storage['curr_session']);
        if(obj.status == 'ok')
            g_curr_session = obj;
    }
    let body_html = storage['html_body'];
    if(body_html != undefined){
        document.onload = function(){console.log('document.load')}
        $('body').html(body_html);
        let scrollTop = window.localStorage['scrollTop'];
        let scrollHeight = window.localStorage['scrollHeight'];

        function judge(){
            return $('#pnl_show')[0].scrollHeight >= scrollHeight;
        }

        WaitForJudge(judge, ()=>{$('#pnl_show').scrollTop(scrollTop);});
    }
}