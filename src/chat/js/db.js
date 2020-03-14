///////////////////////////////////////////////////////////////////////////////////
// 数据库处理

var QQ_db_name = "";
var QQ_db = {};
var myDB = {};
const PAGE_SIZE = 100;

async function OpenDB(name){
    //打开数据库
      //await Dexie.delete(name);
      QQ_db = new Dexie(name);

    //这里的version是设计的数据库的版本号，不是数据库本身的版本号。
      
      QQ_db.version(1).stores({
          message: '++id, time, group_id, [user_id+message_type]',
          message_unread: '++id, time, group_id, [user_id+message_type], &[time+user_id]',
          notice:  '++id, notice_type, group_id, user_id',
          request: '++id, request_type, group_id, user_id', 
          friend_list: 'user_id', //nickname, remark
          friend_group_list: 'friend_group_id', //friend_group_name, friends
          group_list: 'group_id', //group_name
          recent_session: 'type_and_id, msg_item.time',
      });

      QQ_db.version(2).stores({
        message_unread: '++id, time, group_id, [user_id+message_type]',
        message_grouping: "type_and_id" // messages = Array
      })


/*      QQ_db.version(3).stores({
        message_private:'++id, time, group_id',
        message_group:  '++id, time, group_id',
        message_discuss:'++id, time, group_id',
      })*/


      await QQ_db.open().catch(Dexie.abortError, e => {
        console.error(e.message);
      });



/*      var iter = {cnt:0};
      await QQ_db.transaction('rw', QQ_db.message, QQ_db.message_grouping, async ()=>{
        await QQ_db.message.toCollection().each(async m =>{
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
          var item = await QQ_db.message_grouping.get({type_and_id: t_i});
          if(item == undefined){
            QQ_db.message_grouping.add({type_and_id:t_i, messages: Array(m)});
          }
          else{
            QQ_db.message_grouping.where({type_and_id:t_i}).modify(x => {
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
  myDB = window.openDatabase("QQ_1634638631.db","1.0","QQ消息记录",1024*1024*1024);

/*  myDB.transaction( tr =>{
    tr.executeSql('drop table message');
  })*/

  //创表
  myDB.transaction(function(tr){
    tr.executeSql("create table  IF NOT EXISTS message(\
      id Integer primary key autoincrement,\
      chat_id INT8 not null,\
      time INT8 not null,\
      msg_json text not null,\
      UNIQUE (chat_id, time, msg_json) ON CONFLICT IGNORE\
      )");
  }, )
  //创建索引
  myDB.transaction( tr=>{
    tr.executeSql('crate index if not EXISTS message_index ON message (time, chat_id)');
  })                     


//添加：
/*
  myDB.transaction(tr=>{
    tr.executeSql("insert into message(chat_id, time, msg_json) values(?, ?, ?)",[3,444,'{}']);
    tr.executeSql("insert into message(chat_id, time, msg_json) values(?, ?, ?)",[4,555,'{}']);
  });

  QQ_db.message.toArray(ary => {
    myDB.transaction(tr=>{
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


/*let db_keys_id = 0;
let db_msg_keys = undefined;
async function GetNextMsgPage(message_type = undefined, id = undefined){
  filters = {
    "private": x => {return x.user_id == id},
    "group": x => {return x.group_id == id},
    "discuss": x => {return x.discuss_id == id},
  }
  if(message_type != undefined){
    db_keys_id = 0
    db_msg_keys = await QQ_db.message
        .orderBy('time') 
        .filter(filters[message_type])
        .reverse().primaryKeys();
  }
  var res = Array();
  for(let i = 0, len = db_msg_keys.length; i < PAGE_SIZE && db_keys_id < len; i++, db_keys_id++){
    let key = db_msg_keys[db_keys_id];
    res.push(await QQ_db.message.get(key));
  }
  return res;
}*/

let db_keys_id = 0;
let db_msg_keys = undefined;
async function GetNextMsgPage(message_type = undefined, id = undefined){
  chat_id = GetChatId({message_type: message_type, user_id: id, group_id: id, discuss_id: id});
  console.time('get chat_id array');
  if(message_type != undefined){
    db_keys_id = 0
    db_msg_keys = await new Promise( resolve => {
      myDB.readTransaction( transaction => {
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
  console.timeEnd('get chat_id array')

  let res = Array();
  console.time('get a page msg');
  let start = db_keys_id;
  let end = start + PAGE_SIZE;
  res = await GetMessageByIdAry(db_msg_keys.slice(start, end));
  db_keys_id = end;
  console.timeEnd('get a page msg');
  return res;
}

function GetMessageByIdAry(idAry){
  let res = Array();
  return new Promise(resolve => {
    let len = idAry.length;
    myDB.readTransaction(tr => {
      for(let i = 0; i < len; i++)
      {
        tr.executeSql('SELECT msg_json FROM message where id=?;', [idAry[i]], 
          (tr, result) => { 
            res.push( JSON.parse(result.rows.item(0).msg_json) ); 
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