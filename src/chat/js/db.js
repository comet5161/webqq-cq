///////////////////////////////////////////////////////////////////////////////////
// 数据库处理

var QQ_db_name = "";
var QQ_db = {};

async function OpenDB(name){
    //打开数据库
      QQ_db = new Dexie(name);

    //这里的version是设计的数据库的版本号，不是数据库本身的版本号。
      QQ_db.version(2).stores({
          message: '++id, time, user_id, message_type, &message_id',
          notice:  '++id, notice_type, group_id, user_id',
          request: '++id, group_id, user_id', 
          friend_group_list: '++id, &friend_group_id, friend_group_name, friends',
          group_list: '++id, &group_id, group_name',
          group_member_list: '++id, [group_id+user_id], card, nickname' //[A+B]表示Compound Index。
      });

      QQ_db.version(3).stores({
          message: '++id, time, user_id, message_type, &message_id',
          notice:  '++id, notice_type, group_id, user_id',
          request: '++id, group_id, user_id', 
          friend_group_list: '++id, &friend_group_id, friend_group_name, friends',
          group_list: '++id, &group_id, group_name',
          group_member_list: '++id, [group_id+user_id], card, nickname' //[A+B]表示Compound Index。
      });

      QQ_db.version(4).stores({
          message: '++id, time, user_id, message_type, &message_id',
          notice:  '++id, notice_type, group_id, user_id',
          request: '++id, group_id, user_id', 
          friend_list: '++id, &user_id, nickname, remark',
          friend_group_list: '++id, &friend_group_id, friend_group_name, friends',
          group_list: '++id, &group_id, group_name',
          group_member_list: '++id, [group_id+user_id], card, nickname' //[A+B]表示Compound Index。
      });

      QQ_db.version(5).stores({
          message: '++id, time, user_id, group_id, message_type, &message_id',
          notice:  '++id, notice_type, group_id, user_id',
          request: '++id, group_id, user_id', 
          friend_list: '++id, &user_id, nickname, remark',
          friend_group_list: '++id, &friend_group_id, friend_group_name, friends',
          group_list: '++id, &group_id, group_name',
          group_member_list: '++id, [group_id+user_id], card, nickname' //[A+B]表示Compound Index。
      });

      QQ_db.version(6).stores({
          message: '++id, time, user_id, group_id, [group_id+message_type], message_type, &message_id',
          notice:  '++id, notice_type, group_id, user_id',
          request: '++id, group_id, user_id', 
          friend_list: '++id, &user_id, nickname, remark',
          friend_group_list: '++id, &friend_group_id, friend_group_name, friends',
          group_list: '++id, &group_id, group_name',
          group_member_list: '++id, [group_id+user_id], group_id, card, nickname' //[A+B]表示Compound Index。
      });

      QQ_db.version(7).stores({
          message: '++id, time, user_id, group_id, [group_id+message_type], message_type, &message_id',
          notice:  '++id, notice_type, group_id, user_id',
          request: '++id, group_id, user_id', 
          friend_list: '++id, &user_id, nickname, remark',
          friend_group_list: '++id, &friend_group_id, friend_group_name, friends',
          group_list: '++id, &group_id, group_name',
          group_member_list: '++id, [group_id+user_id], group_id, card, nickname' //[A+B]表示Compound Index。
      });


      QQ_db.version(8).stores({
        message_unread: '++id, time, user_id, group_id, [group_id+message_type], message_type, &message_id'
      });

      await QQ_db.open();
}

async function GetGroupMemberCard(group_id, user_id){

}


