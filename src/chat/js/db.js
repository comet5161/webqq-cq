///////////////////////////////////////////////////////////////////////////////////
// 数据库处理

var myIdxDB_name = "";
var myIdxDB = {};
var myWebDB = {};
const PAGE_SIZE = 100;

async function OpenDB(name){
    //打开数据库
      //await Dexie.delete(name);
      myIdxDB = new Dexie(name);

    //这里的version是设计的数据库的版本号，不是数据库本身的版本号。
      
      myIdxDB.version(1).stores({
          message: '++id, time, group_id, [user_id+message_type]',
          message_unread: '++id, time, group_id, [user_id+message_type], &[time+user_id]',
          notice:  '++id, notice_type, group_id, user_id',
          request: '++id, request_type, group_id, user_id', 
          friend_list: 'user_id', //nickname, remark
          friend_group_list: 'friend_group_id', //friend_group_name, friends
          group_list: 'group_id', //group_name
          recent_session: 'type_and_id, msg_item.time',
      });

      myIdxDB.version(2).stores({
        message_unread: '++id, time, group_id, [user_id+message_type]',
        message_grouping: "type_and_id" // messages = Array
      })


/*      myIdxDB.version(3).stores({
        message_private:'++id, time, group_id',
        message_group:  '++id, time, group_id',
        message_discuss:'++id, time, group_id',
      })*/


      await myIdxDB.open().catch(Dexie.abortError, e => {
        console.error(e.message);
      });



/*      var iter = {cnt:0};
      await myIdxDB.transaction('rw', myIdxDB.message, myIdxDB.message_grouping, async ()=>{
        await myIdxDB.message.toCollection().each(async m =>{
          var t_i = m.message_type;
          if(t_i == "group"){
            t_i += "_" + m.group_id;
          }
          else if(t_i == 'private'){
            t_i += "_" + m.user_id;
          }
          else if(t_i == 'discuss'){
            t_i += "_" + m.discuss_id;
          }
          delete m.message_type;
          var item = await myIdxDB.message_grouping.get({type_and_id: t_i});
          if(item == undefined){
            myIdxDB.message_grouping.add({type_and_id:t_i, messages: Array(m)});
          }
          else{
            myIdxDB.message_grouping.where({type_and_id:t_i}).modify(x => {
              x.messages.push(m);
              iter.cnt++;
              if(iter.cnt % 1000 == 0)
                console.log("cnt:" + iter.cnt);
            })
          }
        })
      });
      console.log("transaction finished!")*/

      OpenWebDB();

      console.log('Load DB complete!');
}

function OpenWebDB(){
  //建库
  myWebDB = window.openDatabase("QQ_1634638631.db","1.0","QQ消息记录",1024*1024*1024);

/*  myWebDB.transaction( tr =>{
    tr.executeSql('drop table message_favor');
  })*/

  //创建表
  //保存的消息
  myWebDB.transaction(function(tr){
    tr.executeSql("create table  IF NOT EXISTS message(\
      id Integer primary key autoincrement,\
      chat_id INT8 not null,\
      time INT8 not null,\
      msg_json text not null,\
      UNIQUE (chat_id, time, msg_json) ON CONFLICT IGNORE\
      )");
  }, )

  //收藏的消息
  myWebDB.transaction(function(tr){
    tr.executeSql("create table  IF NOT EXISTS message_favor(\
      id Integer primary key  ON CONFLICT IGNORE,\
      chat_id INT8 not null,\
      time INT8 not null,\
      msg_json text not null,\
      UNIQUE (chat_id, time, msg_json) ON CONFLICT IGNORE\
      )");
  }, );

  //拦截的消息
  myWebDB.transaction(function(tr){
    tr.executeSql("create table  IF NOT EXISTS message_block(\
      id Integer primary key autoincrement,\
      message text not null,\
      UNIQUE (message) ON CONFLICT IGNORE\
      )");
  }, );


  //创建索引
  myWebDB.transaction( tr=>{
    tr.executeSql('crate index if not EXISTS message_index ON message (time, chat_id)');
  })                     


//添加：
/*
  myWebDB.transaction(tr=>{
    tr.executeSql("insert into message(chat_id, time, msg_json) values(?, ?, ?)",[3,444,'{}']);
    tr.executeSql("insert into message(chat_id, time, msg_json) values(?, ?, ?)",[4,555,'{}']);
  });

  myIdxDB.message.toArray(ary => {
    myWebDB.transaction(tr=>{
      ary.forEach(msg=>{
        if(msg.id %  100 == 0)
          console.log('id = ' + msg.id);
        else
          return;
        chat_id = GetChatId(msg);
        tr.executeSql("insert into message(chat_id, time, msg_json) values(?, ?, ?)",
          [chat_id, msg.time, JSON.stringify(msg)]);
        
      })
    });
  })*/

}


async function GetGroupMemberCard(group_id, user_id){

}


function GetMsgIds(chat_id){
    return new Promise( resolve => {
      myWebDB.readTransaction( transaction => {
          transaction.executeSql('SELECT id FROM message WHERE chat_id=? ORDER BY time DESC', [chat_id], 
            (tr,result) => {
              let ary = Array();
              let len = result.rows.length;
              for(let i = 0; i < len; i++)
                ary.push(result.rows.item(i).id);
              resolve(ary);
            }, 
            (tx,error) => {resolve()}
          ); 
      });
    })
}


let db_id_start = 0;
let db_msg_ids = undefined;

async function GetNextMsgPage(message_type = undefined, id = undefined){
  chat_id = GetChatId({message_type: message_type, user_id: id, group_id: id, discuss_id: id});
  console.time('get chat_id array');
  if(message_type != undefined){
    db_id_start = 0
    db_msg_ids = await GetMsgIds(chat_id);
  }
  console.timeEnd('get chat_id array')

  let res = Array();
  console.time('get a page msg');
  let start = db_id_start;
  let end = start + PAGE_SIZE;
  res = await GetMessageByIdAry(db_msg_ids.slice(start, end));
  db_id_start = end;
  console.timeEnd('get a page msg');
  return res;
}

function GetMessageByIdAry(idAry){
  let res = Array();
  return new Promise(resolve => {
    let len = idAry.length;
    if(len == 0)
      resolve(res);
    else
      myWebDB.readTransaction(tr => {
        for(let i = 0; i < len; i++)
        {
          tr.executeSql('SELECT msg_json FROM message where id=?;', [idAry[i]], 
            (tr, result) => { 
              let msg = JSON.parse(result.rows.item(0).msg_json);
              msg.id = idAry[i];
              res.push( msg ); 
              if(res.length == len)
                resolve(res);
            },
            (tr, error) => {
              res.push(undefined);
              if(res.length == len)
                resolve(res);
            }
          )
        
        }
      });
  });
}

async function CheckMessageBlocked(message){
  return new Promise(resolve => {
    myWebDB.readTransaction(tr => {
        tr.executeSql('SELECT message FROM message_block where message=?;', [message], 
          (tr, result) => { 
              if(result.rows.length > 0){
                console.log('拦截的消息:' + message);
                resolve(true);
              }
              else
                resolve(false);
          },
          (tr, error) => {
              resolve(false);
          }
        )
    });
  });
}


function SaveMessage(objMsg){
  return new Promise(resolve => {
      let chat_id = GetChatId(objMsg);
      myWebDB.transaction(tr=>{
          tr.executeSql("insert into message(chat_id, time, msg_json) values(?, ?, ?)",
              [chat_id, objMsg.time, JSON.stringify(objMsg)],
              (tr, result) => {
                  objMsg.id = result.insertId;
                  if(objMsg.message_type == g_curr_session.type)
                      g_curr_session.messages[String(result.insertId)] = objMsg;
                  resolve();
              },
              (tr, error) =>{
                  resolve();
              }
          );
      });
  });
}


function MsgAddBlock(strMsg){
  return new Promise(resolve => {
    myWebDB.transaction(function(tr){
      tr.executeSql(
        'insert into message_block(message) values(?)', [strMsg], 
        (tr,result) => {
          str = 'rowsAffected ' + result.rowsAffected;
          if(result.rowsAffected > 0)
            str += ' add msg block success: id=' + result.insertId + " msg=" + strMsg
          console.log(str);
          resolve();
        },
        (tr, error) => {
          console.log('add msg block fail: ' + strMsg);
          resolve();
        }
      );
    });
  })
}

function MsgAddFavor(objMsg){
  let chat_id = GetChatId(objMsg);
  return new Promise(resolve => {
    myWebDB.transaction(function(tr){
      tr.executeSql(
        'insert into message_favor(id , chat_id, time, msg_json) values(?, ?, ?, ?)',
        [objMsg.id, chat_id, objMsg.time, JSON.stringify(objMsg)], 
        (tr,result) => {
          str = 'rowsAffected ' + result.rowsAffected;
          if(result.rowsAffected > 0)
            str += ' add msg favor success: id=' + result.insertId + " msg=" + objMsg.message
          console.log(str);
          resolve();
        },
        (tr, error) => {
          console.log('add msg favor fail: ' + objMsg.message);
          resolve();
        }
      );
    });
  })
}