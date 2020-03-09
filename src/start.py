# -*- coding: utf-8 -*-
"""
Created on Tue Mar  3 20:41:23 2020

@author: xing
"""

import sqlite3
import re
import os
from tqdm import tqdm
import utils
import nonebot
import groups_member

data_dir = '../../data/'
QQ_id = 1634638631
group_id = 320762705
group = groups_member.groups_members[group_id]

db_path = data_dir + str(QQ_id) + '/logv2_202003.db'
conn = sqlite3.connect(db_path)
c = conn.cursor()

sql = "select ID,datetime(time, 'unixepoch', 'localtime') as t, detail, name from log"
limit = " where detail like '%62705%' and t > '2020-03-05 00:00:00' limit 10000"
#limit = " where detail like '%群: 320762705%' limit 10"
cursor = c.execute(sql+limit)

#群: 320762705 帐号: 635049048 
fweb = open('chat/chat.html','r', encoding='utf-8')
fnew = open('chat/index.html', 'w+', encoding='utf-8')
html = fweb.read()

os.makedirs(data_dir + 'image/cache',  exist_ok=True)

records = [x for x in cursor]
str_msg = ""
for i in tqdm( range(len(records)) ):
    row = records[i]
    idx = row[0]
    msg_time = row[1][11:]
    detail = row[2]
    msg_type = row[3]
    account = "-1"
    #if(msg_type.find('[↓]群组消息') >= 0):
    if(msg_type == '[↓]群组消息'):
        try:
            pos1 = detail.index(' ')
            pos2 = detail.index(' ', pos1+1)
            pos3 = detail.index(' ', pos2+1)
            pos4 = detail.index(' ', pos3+1)
            account = detail[pos3+1:pos4]
            msg = detail[detail.index(' \x0d\x0a')+3:]
        except:
            print(idx)
            print(rf'[id={idx}][{msg_type}]{detail}')
            print('cant get account id=' + str(idx))
            msg = rf'[{msg_type}]' + detail
    else:
        msg = msg_type
    # 获取昵称
    nick_name = account
    str_sex = ""
    if(int(account) > 0):
        nick_name = group[int(account)]['card']
        if(nick_name == ''):
            nick_name = group[int(account)]['nickname']
        # 性别 
        str_sex = group[int(account)]['sex']
        str_sex = str_sex.replace('female', '♀')
        str_sex = str_sex.replace('male', '')
        str_sex = str_sex.replace('unknown', '')

    
    exp = r"(?<=\[CQ:image,file=)[\d\w\.]+(?=\])"
    exp_rm =  r"(\[CQ:image,file=)[\d\w\.]+(\])"
    images = re.findall(exp, msg)
    #print(str(idx) + " " + time + " [" + account + "]" + msg)
    for img_name in images:
        cqimg_path = data_dir + rf"image\{img_name}.cqimg"
        f = open(cqimg_path, mode='r')
        if(f):
            lines = f.readlines()
            if(len(lines) >=6 ):
                img_url = lines[5][4:]
                img_cache_path = data_dir + 'image/cache/' + img_name
                utils.download_img(img_url, img_cache_path)
                # 替换图片标签
                img_html = rf'<br><img class ="msg-img" onclick="" href="../{img_cache_path}" src="../{img_cache_path}" alt="Smiley face">'
                msg = re.sub(exp_rm, msg, img_html, 1, re.MULTILINE)
            f.close()
    # 头像链接
    chathead_path = data_dir + rf'image/cache/account_chathead_{account}.jpg'
    chathead_url = rf'http://q.qlogo.cn/headimg_dl?dst_uin={account}&spec=100'
    utils.download_img(chathead_url, chathead_path)
    str_msg += rf'''
        <div class="msg robot">
            <div class="msg-left" worker="{str_sex} {nick_name} [{msg_time}]">
                <div class="msg-host photo" style="background-image: url(../{chathead_path})"></div>
                <div class="msg-ball" tit
                le="{msg_time}">{msg}</div>
            </div>
        </div>
    '''
# 当前聊天
img_current = ""
title_current = ""


html = html.replace("<div aaa></div>", str_msg)
fnew.write(html)
fnew.close()
fweb.close()
        
    #print(' '.join([str(x) for x in row]))

print("Operation done successfully")
conn.close()