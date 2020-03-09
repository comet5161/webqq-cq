///////////////////////////////////////////////////////////////////////////////////
// 消息格式解析

function parseCQ(msg = str){
  //img_CQ = /\[CQ:image,file=.+?\]/
  //img_url = /(?<=url=).+?(?=\])/

  //解析图片地址
  img_html = '<br><img class ="msg-img" src="$1" alt="Smiley face">'; 
  return msg.replace(/\[CQ:image,file=.+?,url=(.+?)\]/g, img_html) //提取图片的url,放到img_html中$1位置
}