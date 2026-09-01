# 官方游戏客户端 API 错误处理流程

本文描述赛马娘官方客户端收到网络错误或游戏 `result_code` 后，游戏内部经过哪些层、在哪些类中处理，以及最终如何显示错误对话框、返回标题、更新客户端或切换页面。

本文重点是官方游戏客户端的行为，不是 UmaShow 的错误处理设计。

## 1. 信息来源与确定程度

当前流程根据以下内容整理：

- 运行中客户端的 IL2CPP 元数据和方法名。
- `Cute.Http.Assembly.dll`、`Assembly-CSharp.dll` 中恢复出的类和方法。
- `Cute.Http.ResultCode` 与 `Gallop.GallopResultCode` 错误码常量。
- 模拟器当前版本 `master.mdb` 中 `text_data` 的错误标题和正文。
- 已解密的真实游戏响应包。

为了避免把推测写成事实，本文使用以下表述：

- **已经确认**：客户端元数据中存在对应类、方法、常量或专用对话框。
- **流程还原**：根据方法命名、调用职责、游戏表现和响应包还原出的控制流程，实际 IL2CPP 指令可能由多个函数共同完成。
- **未完全确认**：尚未恢复到完整方法体，不能断言内部具体判断顺序或自动重试次数。

## 2. 客户端错误处理的整体分层

官方客户端的错误处理不是一个统一的错误码 `switch`，而是分成多层：

```text
玩家在页面执行操作
例如育成、领取礼物、抽卡、开始比赛
        │
        ▼
对应功能创建一个 API Task
例如 SingleModeExecCommandTask、PresentReceiveTask
        │
        ▼
Gallop.HttpHelper
负责游戏层请求、响应头和公共错误处理
        │
        ▼
Cute.Http.HttpManager
负责请求队列、连接、超时、底层重试和数据解析
        │
        ▼
UnityWebRequest / WWWRequest
向游戏服务器发送请求
```

响应回来以后反向处理：

```text
HTTP 响应或网络异常
        │
        ▼
Cute.Http.HttpManager
先处理超时、断网、解密和反序列化错误
        │
        ▼
Gallop.HttpHelper.CommonProcessOnResponded
更新 SID、响应头和服务器信息
        │
        ▼
读取 result_code
        │
        ├─ 成功：调用当前 Task 的成功回调
        │
        └─ 失败：先调用当前 Task.OnError
                    │
                    ├─ 当前功能处理了错误：执行专用页面逻辑
                    │
                    └─ 当前功能没有处理：进入全局公共错误处理
                                               │
                                               ▼
                                  HttpHelper.CommonError_BUMA
                                               │
                                               ▼
                                  DialogManager.PushErrorCommon
                                               │
                                               ▼
                                  用户点击按钮后执行对应回调
```

## 3. 第一层：底层网络和数据解析

已经确认的位置：

```text
程序集：Cute.Http.Assembly.dll
命名空间：Cute.Http
类：HttpManager
```

已经确认存在的方法：

```text
CreateRequest
EnqueueHttpTask
SendTask
WaitCoolTime
Retry
RetryImmediate
RetryLater
ClearAllTask
DisposeCurrentOperation
InterruptAuthTask
ClearAllCache
```

已经确认的底层错误类型：

```text
TimeOut
WwwError
DeserializeError
DecryptError
PayloadTooLargeError
```

这一层的流程为：

```text
请求进入 HttpManager 队列
        │
        ▼
等待 API 请求间隔
        │
        ▼
发送 HTTP 请求
        │
        ├─ 超时
        │    形成 TimeOut
        │
        ├─ 断网、DNS、HTTP 连接失败
        │    形成 WwwError
        │
        ├─ 响应无法解压或反序列化
        │    形成 DeserializeError
        │
        ├─ 响应无法解密
        │    形成 DecryptError
        │
        ├─ 响应或请求数据过大
        │    形成 PayloadTooLargeError
        │
        └─ 数据成功解析
             交给 Gallop.HttpHelper
```

底层错误发生后，`HttpManager` 根据当前请求的发送选项决定：

```text
允许立即重试
    → RetryImmediate

允许延迟重试
    → RetryLater

不允许重试或超过重试条件
    → 结束当前 Operation
    → 将网络错误交给游戏层显示
```

因此，官方客户端确实存在自动重试机制，但它首先用于网络、超时和底层传输错误。不能据此认为所有游戏 `result_code` 都会自动重试。

## 4. 第二层：游戏公共响应处理

已经确认的位置：

```text
程序集：Assembly-CSharp.dll
命名空间：Gallop
类：HttpHelper
```

已经确认存在的方法：

```text
SendAfterLockUI
_Send
ActivateSendOption
DeactivateSendOption
CommonProcessOnResponded
UpdateSessionID
UpdateHeader
CommonSuccess
CommonError
CommonError_BUMA
commonShowDialogProc
hookErrorWithContinuation
onErrorWithContinuation
```

这一层的主要职责是：

```text
发送请求前
    → 锁定相关 UI
    → 显示连接状态
    → 防止连续点击

收到响应后
    → 更新公共响应头
    → 更新会话 SID
    → 更新资源版本和服务器信息
    → 读取 result_code

请求结束后
    → 解除连接状态
    → 恢复 UI 操作
```

即使服务器返回的是业务错误，响应头中仍可能携带新的 SID 或版本信息。因此客户端会先处理响应头，再决定响应成功还是失败。

## 5. result_code 的基本分流

游戏层取得 `result_code` 后，整体流程如下：

```text
读取 result_code
        │
        ├─ result_code = 1
        │       │
        │       ▼
        │   CommonSuccess
        │       │
        │       ▼
        │   当前 Task.OnSuccess
        │       │
        │       ▼
        │   更新页面或进入下一流程
        │
        └─ result_code != 1
                │
                ▼
          生成游戏错误信息
                │
                ▼
          当前 Task.OnError
                │
                ├─ 返回“已处理”
                │       当前功能完成专用处理
                │
                └─ 返回“未处理”
                        进入 CommonError / CommonError_BUMA
```

## 6. 第三层：当前功能自己的 OnError

客户端中大量 API Task 都有自己的 `OnError` 方法。已经确认的例子包括：

```text
SingleModeExecCommandTask.OnError
SingleModeCheckEventTask.OnError
SingleModeRaceStartTask.OnError
PresentReceiveTask.OnError
GachaExecTask.OnError
PracticeRaceRaceStartTask.OnError
FriendSearchTask.OnError
PaymentStartTask.OnError
RoomMatchEntryRoomTask.OnError
```

这说明同一个错误响应的处理顺序是：

```text
先问当前功能：“这个错误是不是你自己的业务错误？”
        │
        ├─ 是
        │    当前功能自己处理
        │
        │    例如：
        │    · 刷新礼物箱列表
        │    · 回到未处理的育成事件
        │    · 提示活动已经结束
        │    · 刷新兑换商品列表
        │    · 关闭已经过期的房间
        │    · 返回当前功能的入口页面
        │
        └─ 否
             交给全局公共错误处理
```

因此，数据库中即使有 206 个错误码，也不能仅凭数据库生成完全准确的处理表。具体页面动作可能写在对应的 `*Task.OnError` 中。

## 7. 第四层：全局公共错误处理

已经确认的公共入口：

```text
Gallop.HttpHelper.CommonError
Gallop.HttpHelper.CommonError_BUMA
Gallop.HttpHelper.commonShowDialogProc
```

公共错误处理主要负责：

```text
维护错误
会话错误
账号状态错误
客户端版本错误
资源版本错误
服务端公共错误
当前 Task 没有处理的普通业务错误
```

整体流程：

```text
CommonError_BUMA 收到错误码
        │
        ├─ 全局维护
        │    停止当前流程
        │    显示维护信息
        │    返回维护页面或标题页
        │
        ├─ 功能维护
        │    禁止进入当前功能
        │    显示对应功能的维护信息
        │
        ├─ 会话错误
        │    停止当前请求队列
        │    显示会话错误
        │    返回标题页
        │
        ├─ 账号限制
        │    停止继续请求
        │    显示账号状态
        │    返回标题页
        │
        ├─ 客户端版本错误
        │    显示版本更新对话框
        │    前往应用商店
        │
        ├─ 资源版本错误
        │    显示发现新数据
        │    返回初始化流程
        │    检查并下载资源
        │
        └─ 普通业务错误
             从 master.mdb 读取标题和正文
             显示普通错误对话框
             点击按钮后执行当前错误的回调
```

## 8. 错误标题和正文的来源

错误码的显示文案来自 `master.mdb` 的 `text_data`：

```text
result_code
     │
     ├─ category = 2，index = result_code
     │    得到错误标题
     │
     └─ category = 1，index = result_code
          得到详细正文
```

查询关系：

```sql
SELECT
  e.[index] AS error_code,
  e.text AS title,
  b.text AS body
FROM text_data e
LEFT JOIN text_data b
  ON b.category = 1
 AND b.[index] = e.[index]
WHERE e.category = 2
ORDER BY e.[index];
```

数据库决定的是：

```text
对话框标题显示什么
对话框正文显示什么
```

数据库不决定：

```text
点击确定后去哪里
是否重新发送请求
是否返回标题页
是否打开应用商店
是否重新下载资源
是否刷新当前页面
```

这些动作由 DLL 中传给对话框的回调决定。

## 9. 第五层：错误对话框

已经确认的位置：

```text
命名空间：Gallop
类：DialogManager
```

已经确认存在的方法和字段：

```text
PushErrorCommon
PushSystemDialog
PopDialog
RemoveAllDialog
DestroyAllDialog
IsShowErrorDialog
MAX_ERROR_DIALOG_NUM
```

显示流程：

```text
错误处理器准备：
    · 标题
    · 正文
    · 按钮类型
    · 点击按钮后的回调
        │
        ▼
DialogManager.PushErrorCommon
        │
        ▼
显示公共错误对话框
        │
        ▼
玩家点击按钮
        │
        ▼
关闭或销毁对话框
        │
        ▼
执行错误处理器提供的回调
```

因此看起来相同的“确定”按钮，关闭后可能执行完全不同的动作。

## 10. 201：会话失效

已经确认的常量：

```text
Cute.Http.ResultCode.API_RESULT_SESSION_ERROR = 201
Gallop.GallopResultCode.SESSION_ERROR
```

客户端流程：

```text
任意 API 返回 201
        │
        ▼
当前 Task.OnError
        │
        └─ 通常不作为当前功能业务错误处理
                │
                ▼
        HttpHelper.CommonError_BUMA
                │
                ▼
        停止或清理当前请求流程
                │
                ▼
        显示“长时间未操作或连接中断”
                │
                ▼
        玩家点击确定
                │
                ▼
        GallopUtil.GotoTitleOnError
                │
                ▼
        返回标题页
                │
                ▼
        MainGameInitializer 重新执行登录初始化
                │
                ▼
        重新 Signup / StartSession / Load
```

官方客户端的主要行为是返回标题后重新执行登录流程，而不是在当前页面直接重发刚才的业务请求。

## 11. 217：连接或会话冲突

当前数据库正文表示连接发生冲突，需要返回标题后在稳定网络中重新尝试。

真实抓包中，`217` 出现在多种接口：

```text
single_mode/exec_command
single_mode/check_event
礼物箱和列表类请求
登录及 load/index 附近请求
```

因此 `217` 不是某个接口的参数错误，而是会话级错误。

客户端流程：

```text
API 返回 217
        │
        ▼
当前 Task.OnError
        │
        └─ 当前功能通常无法自行修复
                │
                ▼
        公共会话错误处理
                │
                ▼
        停止当前操作和后续请求
                │
                ▼
        显示连接冲突错误正文
                │
                ▼
        玩家点击确定
                │
                ▼
        返回标题页
                │
                ▼
        重新执行 StartSession 和加载流程
```

目前没有证据表明官方客户端会在后台自动等待十分钟。等待十分钟属于自动化程序防止与其他客户端持续争抢会话的额外保护策略。

## 12. 218：其他设备登录

当前数据库正文明确表示账号已在其他设备登录。

客户端流程：

```text
API 返回 218
        │
        ▼
公共账号/会话错误处理
        │
        ▼
停止当前设备的会话操作
        │
        ▼
显示“已在其他设备登录”
        │
        ▼
玩家点击确定
        │
        ▼
返回标题页
```

`217` 与 `218` 的区别：

```text
217
    当前连接或会话状态发生冲突、缺失或失效。

218
    明确检测到账号已经在其他设备取得登录会话。
```

## 13. 204：客户端版本错误

已经确认的常量：

```text
Cute.Http.ResultCode.API_RESULT_VERSION_ERROR = 204
Gallop.GallopResultCode.VERSION_ERROR
```

客户端流程：

```text
API 返回 204
        │
        ▼
停止当前登录或业务流程
        │
        ▼
显示“发现新版本”对话框
        │
        ▼
玩家点击更新
        │
        ▼
打开对应应用商店页面
```

客户端不会将 `204` 当成普通网络错误循环重试。

## 14. 214：资源版本错误

已经确认的客户端命名：

```text
Gallop.GallopResultCode.RESOURCE_VERSION_ERROR
MainGameInitializer.ShowResourceUpdateDialog
MainGameInitializer.CheckUpdateResourceVersion
```

客户端流程：

```text
API 返回 214
        │
        ▼
检测到客户端资源版本过旧
        │
        ▼
显示“发现新数据”对话框
        │
        ▼
结束当前业务流程
        │
        ▼
回到 MainGameInitializer
        │
        ▼
CheckUpdateResourceVersion
        │
        ▼
更新资源清单、资源文件和 master 数据
        │
        ▼
重新进入登录或游戏流程
```

区别：

```text
204：应用程序版本过旧，需要更新 APK。
214：游戏资源版本过旧，需要重新下载资源。
```

## 15. 101 和 2000–2999：维护

已经确认的常量：

```text
RESULT_CODE_MAINTENANCE_COMMON = 101
RESULT_CODE_MAINTENANCE_FROM = 2000
RESULT_CODE_MAINTENANCE_TO = 2999
```

处理区别：

```text
101：全局维护
    整个游戏服务不可用。
    停止启动或当前业务流程。
    显示全局维护信息。

2000–2999：具体功能维护
    游戏其他功能可能仍然可用。
    当前功能被禁止进入或继续操作。
    显示对应功能的维护信息。
```

`GallopResultCode` 中存在大量功能维护常量，例如：

```text
MAINTENANCE_TASK_PRESENT
MAINTENANCE_TASK_PAYMENT_ALL
MAINTENANCE_TASK_GACHA
MAINTENANCE_TASK_SHOP_ITEM_EXCHANGE
MAINTENANCE_TASK_SINGLE_MODE
MAINTENANCE_TASK_CIRCLE
MAINTENANCE_TASK_TEAM_STADIUM
MAINTENANCE_TASK_DAILY_RACE
MAINTENANCE_TASK_LEGEND_RACE
MAINTENANCE_TASK_ROOM_MATCH
MAINTENANCE_TASK_PRACTICE_RACE
```

功能维护流程：

```text
当前功能请求返回维护码
        │
        ▼
当前 Task 或公共错误处理识别维护类型
        │
        ▼
停止当前功能的操作
        │
        ▼
显示对应维护正文
        │
        ▼
关闭当前页面或返回功能入口
```

## 16. 102：服务器错误

已经确认的常量：

```text
Cute.Http.ResultCode.RESULT_CODE_SERVER_ERROR = 102
Gallop.GallopResultCode.SERVER_ERROR
```

大致流程：

```text
API 返回 102
        │
        ▼
当前 Task 判断是否能提供专用恢复
        │
        ├─ 能处理
        │    当前功能刷新或结束流程
        │
        └─ 不能处理
             显示公共服务器错误
             根据当前请求选项决定是否允许用户重试
```

尚未确认官方客户端对所有 `102` 都使用相同的自动重试次数。育成、抽卡、比赛开始等请求可能已经在服务器执行，不能仅根据 `102` 推断客户端一定会重发。

## 17. 203：账号限制或封禁

已经确认的常量：

```text
Cute.Http.ResultCode.RESULT_CODE_ACCOUNT_BLOCK_ERROR = 203
Gallop.GallopResultCode.ACCOUNT_BLOCK_ERROR
```

客户端流程：

```text
API 返回 203
        │
        ▼
公共账号错误处理
        │
        ▼
停止继续发送业务请求
        │
        ▼
显示账号限制正文
        │
        ▼
返回标题页或停留在阻断页面
```

这类错误不会通过普通重试恢复。

## 18. 213：服务器认为请求已经处理

已经确认的常量：

```text
Cute.Http.ResultCode.RESULT_CODE_PROCESSED_ERROR = 213
```

含义重点不是“网络失败”，而是服务器认为该请求已经处理、重复或当前客户端状态落后。

流程：

```text
API 返回 213
        │
        ▼
不进入普通网络立即重试
        │
        ▼
交给当前 Task.OnError
        │
        ├─ 当前功能能够确认服务器状态
        │    刷新页面或加载最新状态
        │
        └─ 当前功能无法确认
             显示错误并结束当前操作
```

当前尚未恢复所有 Task 对 `213` 的具体处理方法体，因此不能认为所有接口都会执行相同页面跳转。

## 19. 205、208、413 和 8501

### 205

`GallopResultCode` 中存在参数错误相关常量，例如：

```text
PARAM_ERROR
POST_DATA_ERROR
INVALID_PARAMETER_ERROR
```

一般流程：

```text
当前 Task.OnError 尝试识别具体参数问题
        │
        ├─ 可以恢复：刷新当前页面或重新生成请求内容
        └─ 不可恢复：显示数据库正文
```

### 208

`GallopResultCode` 中存在：

```text
DOUBLE_CLICK_ERROR
```

它属于短时间重复操作或状态冲突类错误。当前接口可以选择刷新状态或提示用户再次操作。尚未确认官方客户端统一自动重试六次；该次数属于外部自动化项目的处理策略。

### 413

已经确认：

```text
Cute.Http.ResultCode.RESULT_CODE_PAYLOAD_TOO_LARGE_ERROR = 413
Cute.Http.ErrorType.PayloadTooLargeError
```

流程：

```text
检测到请求或响应体过大
        │
        ▼
终止当前数据处理
        │
        ▼
显示公共错误或交给当前 Task.OnError
```

### 8501

数据库正文表示服务器繁忙、请重试。

流程：

```text
API 返回 8501
        │
        ▼
显示服务器繁忙提示
        │
        ▼
由当前页面提供关闭或重试操作
```

目前没有证据证明官方客户端对所有 `8501` 使用固定的指数退避次数。

## 20. 启动阶段的专用错误处理

已经确认的位置：

```text
类：Gallop.MainGameInitializer
方法：StartSession
方法：OnStartSessionError
```

启动阶段流程：

```text
MainGameInitializer.StartSession
        │
        ├─ 成功
        │    继续 SetupManifestAndMaster
        │    继续登录和页面恢复
        │
        └─ 失败
             OnStartSessionError
                    │
                    ├─ 账号删除专用错误
                    │    打开对应专用对话框
                    │
                    └─ 其他错误
                         交给公共错误处理
```

已经确认的专用分支：

```text
1203
    → DialogAccountDeletionCancel.Open
    → 显示取消账号删除流程

1204
    → DialogAccountDeletionAfterCancellationPeriod.Open
    → 显示已经超过可取消期限

1205
    → DialogAccountDeletionComplete.Open
    → 显示账号删除已经完成
```

这些错误不会只显示 `text_data` 公共对话框，而是打开完整的专用 UI。

## 21. 下载错误使用独立流程

已经确认的位置：

```text
类：Gallop.DownloadErrorProcessor
方法：ExecDownloadErrorProcess
方法：OnClickRetry
方法：OnClickGoToTitle
```

已经确认的下载错误类别：

```text
TimeoutCommon
ConnectCommon
IOCommon
DiskFull
```

下载错误流程：

```text
资源下载失败
        │
        ▼
DownloadErrorProcessor.ExecDownloadErrorProcess
        │
        ├─ 网络超时
        ├─ 无法连接或解析服务器地址
        ├─ 文件 IO 错误
        └─ 磁盘空间不足
                │
                ▼
        显示下载错误对话框
                │
                ├─ 点击重试
                │    OnClickRetry
                │    重新执行下载
                │
                └─ 点击返回标题
                     OnClickGoToTitle
                     结束下载并返回标题页
```

资源下载错误和普通 API `result_code` 错误不是同一套入口。

## 22. 为什么不能只根据错误码正文判断处理方式

一个完整错误处理由以下信息共同决定：

```text
错误码 result_code
        ＋
当前是哪个 API Task
        ＋
当前页面和场景
        ＋
Task.OnError 是否消费该错误
        ＋
公共错误处理分类
        ＋
对话框按钮回调
```

例如同样是“活动期限已结束”：

```text
在活动入口页面发生
    → 可能刷新活动列表并关闭入口

在活动比赛页面发生
    → 可能中断比赛流程并回到活动主页

在领取奖励时发生
    → 可能刷新奖励状态并关闭领取对话框
```

显示的数据库正文可能相似，但对应的 `Task.OnError` 和页面回调不同。

## 23. 官方客户端完整文字流程图

```text
玩家执行操作
        │
        ▼
当前功能创建 API Task
        │
        ▼
HttpHelper 锁定相关 UI
        │
        ▼
HttpManager 将请求加入队列
        │
        ▼
发送网络请求
        │
        ├─ 网络、超时、解密或反序列化错误
        │       │
        │       ├─ 当前发送选项允许重试
        │       │       → RetryImmediate / RetryLater
        │       │
        │       └─ 不允许或无法恢复
        │               → 显示网络错误
        │               → 重试或返回标题
        │
        └─ 成功得到游戏响应
                │
                ▼
        HttpHelper 更新响应头和 SID
                │
                ▼
        读取 result_code
                │
                ├─ 成功
                │    → CommonSuccess
                │    → Task.OnSuccess
                │    → 更新当前页面
                │
                └─ 失败
                     │
                     ▼
              当前 Task.OnError
                     │
                     ├─ 当前功能认识并处理该错误
                     │    → 刷新、关闭、跳转或显示专用 UI
                     │
                     └─ 当前功能未处理
                          │
                          ▼
                  HttpHelper.CommonError_BUMA
                          │
                          ├─ 维护
                          │    → 显示维护信息
                          │
                          ├─ 会话失效或冲突
                          │    → 停止请求
                          │    → 显示错误
                          │    → 返回标题
                          │
                          ├─ 账号限制
                          │    → 停止账号操作
                          │    → 显示账号状态
                          │
                          ├─ 客户端版本过旧
                          │    → 显示更新对话框
                          │    → 打开应用商店
                          │
                          ├─ 资源版本过旧
                          │    → 显示新数据提示
                          │    → 重新检查和下载资源
                          │
                          └─ 普通业务错误
                               → master.mdb 读取标题和正文
                               → DialogManager.PushErrorCommon
                               → 玩家点击按钮
                               → 执行对应回调
```

## 24. 常见错误码处理对照表

下表将官方客户端已经观察到的处理表现与 UmaShow、UmaAutoResearch 等自动化程序的建议处理分开记录。

其中“自动化建议”是为了避免重复提交、会话争抢或无限重试，不代表官方客户端内部一定使用相同的等待时间和重试次数。

| 错误码 | 含义 | 官方客户端处理表现 | 自动化程序建议 |
| --- | --- | --- | --- |
| `101` | 全局维护 | 中断当前流程，显示全局维护信息，停留在维护流程或返回标题页 | 停止全部游戏请求，等待维护结束后重新登录 |
| `102` | 服务端内部错误 | 当前 Task 先尝试处理；未处理时显示公共服务器错误，部分页面可能提供重试 | 查询请求可有限重试；育成、比赛等写操作不要直接重放，先刷新服务器状态，必要时停止或放弃当前局 |
| `201` | 会话失效、长时间未操作 | 显示会话中断提示，停止当前请求，点击确定后返回标题页并重新执行登录流程 | 丢弃旧 SID，重新登录并加载最新状态；写操作不应在重登后直接重放 |
| `203` | 账号封禁或限制 | 进入账号限制公共分支，停止继续请求，显示账号状态并阻断游戏流程 | 停止自动化，保留错误正文，交给用户人工处理 |
| `204` | 客户端版本错误 | 显示发现新版本，点击更新后前往应用商店 | 停止请求并更新客户端，不应循环重试旧版本接口 |
| `205` | 表单或请求参数错误 | 当前 Task 尝试处理具体参数问题；未处理时显示错误正文 | 检查和修正请求参数，不要当作会话错误反复重新登录 |
| `208` | 重复点击或短暂状态冲突 | 当前 Task 可以刷新状态或提示玩家重新操作；尚未确认存在统一的固定重试次数 | 只读或已确认安全的请求可短间隔有限重试，例如最多 6 次、间隔约 0.6–1.4 秒；写操作先刷新状态 |
| `213` | 请求已处理或重复处理 | 不作为普通网络失败处理，优先交给当前 Task 刷新或核对业务状态 | 先重新加载服务器状态，确认原操作是否已经成功，禁止原样盲目重放 |
| `214` | 检测到新资源数据 | 显示发现新数据，返回初始化流程，重新检查资源版本并下载资源 | 停止当前操作，更新资源和 `master.mdb`，完成后重新登录和加载状态 |
| `217` | 登录或会话连接冲突 | 停止当前请求，显示连接冲突错误，点击确定后返回标题并重新执行 `StartSession` | 首次出现时重建会话并刷新状态；短期重复出现时暂停约 10 分钟，避免与官方客户端持续争抢会话 |
| `218` | 已在其他设备登录 | 停止当前设备的会话操作，显示其他设备登录提示，点击确定后返回标题页 | 停止自动化且不要持续重登，让用户决定继续使用哪个设备 |
| `413` | 请求体或响应数据过大 | 底层可能形成 `PayloadTooLargeError`，终止当前数据处理并显示公共错误或交给 Task 处理 | 缩小或修正请求内容，不应使用相同数据原样重试 |
| `8501` | 服务器繁忙 | 显示服务器繁忙、请重试的正文，由当前页面提供关闭或重试操作 | 仅对安全请求进行有上限的指数退避；写操作先查询服务器状态 |
| `2000–2999` | 功能维护区间 | 识别具体维护功能，禁止进入或继续使用对应功能，并显示维护正文 | 停止对应功能的请求，其他未维护功能可以继续使用，等待维护结束后刷新状态 |
| `5000/5100/5200` 系列 | 各功能业务校验错误 | 先进入对应 `Task.OnError`；由当前功能决定刷新列表、关闭页面、返回入口或显示专用提示 | 显示数据库正文并刷新相关页面，默认不自动重试；只有明确确认请求安全时才考虑再次提交 |

### 表格使用注意事项

```text
“官方客户端处理表现”
    来自客户端类、方法名、错误文案和实际运行表现。

“自动化程序建议”
    是 UmaShow 或其他自动化调用客户端时应采用的安全策略。
```

以下数值不能当作官方客户端已经确认的内部常量：

```text
217 重复后等待约 10 分钟
208 最多重试 6 次
208 间隔约 0.6–1.4 秒
8501 使用指数退避
```

这些数值来自自动化运行经验和防止会话争抢、重复写入的保护设计。

## 25. 总结

官方客户端的错误处理可以概括为五层：

```text
第一层：HttpManager
处理超时、断网、数据过大、解密和反序列化失败。

第二层：HttpHelper
更新 SID、响应头并读取 result_code。

第三层：具体 API Task.OnError
处理当前功能独有的业务错误和页面恢复。

第四层：CommonError_BUMA
处理维护、会话、账号、版本和其他公共错误。

第五层：DialogManager
显示 master.mdb 中的标题和正文，并在玩家点击后执行 DLL 中定义的回调。
```

最核心的调用方向为：

```text
HttpManager
→ HttpHelper.CommonProcessOnResponded
→ 当前 Task.OnError
→ HttpHelper.CommonError_BUMA
→ DialogManager.PushErrorCommon
→ 按钮回调执行重试、刷新、更新或返回标题
```
