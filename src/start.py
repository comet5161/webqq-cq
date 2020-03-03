# -*- coding: utf-8 -*-
"""
Created on Tue Mar  3 20:41:23 2020

@author: xing
"""

import sqlite3
import re

db_path = 'C:/Users/xing/Downloads/酷Q Air/data/1634638631/logv2_202003.db'
conn = sqlite3.connect(db_path)
c = conn.cursor()

sql = "select ID,datetime(time, 'unixepoch', 'localtime') as t, detail from log"
limit = " where detail like '%62705%' and t > '2020-03-03 16:52:39' limit 10"
cursor = c.execute(sql+limit)
print('id time detail')
#群: 320762705 帐号: 635049048 

for row in cursor:
    idx = row[0]
    time = row[1]
    detail = row[2]
    pos1 = detail.index(' ')
    pos2 = detail.index(' ', pos1+1)
    pos3 = detail.index(' ', pos2+1)
    pos4 = detail.index(' ', pos3+1)
    account = detail[pos3+1:pos4]
    msg = detail[detail.index(' \x0d\x0a')+3:]
    exp = r"(?<=\[CQ:image,file=)[\d\w\.]+(?=\])"
    images = re.findall(exp, msg)
    print(str(idx) + " " + time + " [" + account + "]" + msg)
    for img_path in images:
        path = rf"C:\Users\xing\Downloads\酷Q Air\data\image\{img_path}.cqimg"
        f = open(path, mode='r')
        if(f):
            lines = f.readlines()
            if(len(lines) >=6 ):
                print(lines[5])
            f.close()
        
    #print(' '.join([str(x) for x in row]))

print("Operation done successfully")
conn.close()