# GROQ CLOUD API 代理服务
## 项目简介
该项目是一个GROQ CLOUD API代理服务，用于解决中国访问GROQ CLOUD API的网络问题。
## 项目诞生背景
1.由于DeepSeek被围攻，导致无法使用DeepSeek的API。

2.本地部署DeepSeek需要显卡，本地部署成本较高。

3.GROQ CLOUD 提供了免费的DeepSeek 70b的模型调用服务，
但是中国访问GROQ CLOUD API的网络问题，

导致一些中国用户无法正常使用GROQ CLOUD API。
因此，我们开发了这个项目，用于解决这个问题。
## Deno部署（推荐）操作步骤
### 1.需要特殊网络环境(即梯子)
本项目不做推荐，自行解决
### 2.从GROQ CLOUD 获取 API KEY
 [点击注册账号](https://groq.com)，获取 api key
### 3.Fork 本项目到GitHub
[点击Fork](https://github.com/1332165192/groq_proxy/fork)
### 4.DENO登录/注册
[点击登录/注册](https://deno.com)，一般选择GitHub登录即可
### 5.DENO创建项目
[点击创建项目](https://dash.deno.com/new_project)
### 6.选择此项目，填写项目名字（请仔细填写项目名字，关系到自动分配的域名）
### 7.Entrypoint 填写 deno.mjs 其他字段留空
 <details>
   <summary>如图</summary>
   
   ![image](/docs/images/1.png)
   </details>

### 8.点击 Deploy Project部署，等待部署完成，部署完成后，点击项目，查看项目地址，复制项目地址，打开项目地址，查看项目是否正常，如果正常，则表示部署成功，如果失败，请查看日志，如果日志有报错，请查看报错信息，如果报错信息有提示，请按照提示解决，如果报错信息没有提示，请查看项目地址，查看项目是否正常，如果正常，则表示部署成功，如果失败，请查看日志，如果日志有报错，请查看报错信息，如果报错信息有提示，请按照提示解决，如果报错信息没有提示，请查看项目地址，查看项目是否正常，如果正常

参考链接、文档:
https://github.com/Ikaros-521
