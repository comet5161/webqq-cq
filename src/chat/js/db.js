///////////////////////////////////////////////////////////////////////////////////
// 数据库处理

var QQ_db_name = "";
var QQ_db = {};

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

      await QQ_db.open().catch(Dexie.abortError, e => {
        console.error(e.message);
      });

      console.log('Load DB complete!');
}

async function GetGroupMemberCard(group_id, user_id){

}


