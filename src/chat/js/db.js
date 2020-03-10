///////////////////////////////////////////////////////////////////////////////////
// 数据库处理

var QQ_db_name = "";
var QQ_db = {};
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

      console.log('Load DB complete!');
}

async function GetGroupMemberCard(group_id, user_id){

}


let db_keys_id = 0;
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
}

