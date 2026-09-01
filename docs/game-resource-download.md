# 游戏资源文件下载说明

本文说明如何从 MuMu 模拟器中的资源清单定位游戏资源，并通过 CDN 下载、解压 `master.mdb`。

当前版本不再直接保存：

```text
/data/user/0/com.bilibili.umamusu/master/master.mdb
```

资源采用以下布局：

```text
/data/user/0/com.bilibili.umamusu/files/meta
/data/user/0/com.bilibili.umamusu/files/dat/<哈希前两位>/<完整哈希>
```

- `meta`：SQLite 格式的资源清单
- `dat`：已经下载到本地的哈希资源缓存
- `master.mdb`：在资源清单中通常记录为 `master.mdb.lz4`，下载后需要 LZ4 解压

## 准备工具

需要以下命令：

- `adb`
- `sqlite3`
- `curl`
- `lz4`

MuMu 模拟器常用的 ADB 地址为：

```text
127.0.0.1:7555
```

## 1. 连接模拟器

```powershell
adb connect 127.0.0.1:7555
adb -s 127.0.0.1:7555 root
```

确认应用数据目录可以访问：

```powershell
adb -s 127.0.0.1:7555 shell ls -la /data/user/0/com.bilibili.umamusu/files
```

如果 `adb root` 不可用，需要在 MuMu 设置中启用 Root 权限。

## 2. 导出资源清单

将游戏的 `meta` 数据库导出到当前目录：

```powershell
adb -s 127.0.0.1:7555 pull /data/user/0/com.bilibili.umamusu/files/meta .\meta
```

查询 `master.mdb.lz4` 的资源记录：

```powershell
sqlite3.exe .\meta "SELECT n, h, l, m, k FROM a WHERE n LIKE '%master.mdb%';"
```

字段含义：

| 字段 | 含义 |
| --- | --- |
| `n` | 资源逻辑名称，例如 `master.mdb.lz4` |
| `h` | CDN 文件哈希，也是实际文件名 |
| `l` | 压缩资源的预期字节数 |
| `m` | 资源分类信息 |
| `k` | 资源类型信息 |

2026-08-29 的已验证记录为：

```text
n = master.mdb.lz4
h = 4RCVLKQCRHAWT4LUD4AES5L2YAQHGU33
l = 7991899
m = master
k = 10
```

每次游戏更新后都应重新查询 `meta`，不要长期写死哈希。

## 3. 拼接 CDN 下载地址

登录或资源版本响应中的服务器字段为：

```text
server_list.resource_server
```

当前服务器基址为：

```text
https://l2-prod-patch-uma.bilibiligame.net/youjun/dl/vertical/
```

`master.mdb.lz4` 属于 `Generic` 资源，URL 规则为：

```text
<服务器基址>/resources/Generic/<哈希前两位>/<完整哈希>
```

例如哈希：

```text
4RCVLKQCRHAWT4LUD4AES5L2YAQHGU33
```

其前两位是 `4R`，完整地址为：

```text
https://l2-prod-patch-uma.bilibiligame.net/youjun/dl/vertical/resources/Generic/4R/4RCVLKQCRHAWT4LUD4AES5L2YAQHGU33
```

其他已观察到的资源分类基址包括：

```text
resources/Generic
resources/Manifest
resources/Android/assetbundles
```

分类必须正确，并且哈希和前两位路径区分大小写。

## 4. 下载并解压 `master.mdb`

可以手动下载：

```powershell
$url = 'https://l2-prod-patch-uma.bilibiligame.net/youjun/dl/vertical/resources/Generic/4R/4RCVLKQCRHAWT4LUD4AES5L2YAQHGU33'
curl.exe --fail --location --output master.mdb.lz4 $url
lz4.exe -d -f master.mdb.lz4 master.mdb
```

也可以从 `meta` 自动读取最新哈希：

```powershell
$cdn = 'https://l2-prod-patch-uma.bilibiligame.net/youjun/dl/vertical'
$hash = (sqlite3.exe .\meta "SELECT h FROM a WHERE n = 'master.mdb.lz4' LIMIT 1;").Trim()

if ([string]::IsNullOrWhiteSpace($hash)) {
    throw 'meta 中没有找到 master.mdb.lz4'
}

$prefix = $hash.Substring(0, 2)
$url = "$cdn/resources/Generic/$prefix/$hash"

Write-Output "Downloading $url"
curl.exe --fail --location --output master.mdb.lz4 $url
lz4.exe -d -f master.mdb.lz4 master.mdb
```

如果 `resource_server` 发生变化，应使用服务器响应里的最新值替换 `$cdn`。

## 5. 验证下载结果

检查压缩文件大小：

```powershell
Get-Item .\master.mdb.lz4 | Select-Object Name, Length
```

文件大小应与 `meta.a.l` 字段一致。

检查解压后的数据库：

```powershell
sqlite3.exe .\master.mdb "PRAGMA quick_check;"
```

正常结果应为：

```text
ok
```

当前示例的验证结果：

| 项目 | 值 |
| --- | --- |
| LZ4 文件大小 | `7,991,899` 字节 |
| LZ4 文件 MD5 | `3ABE5FF15F909B7ECE06CA5F98866772` |
| 解压后大小 | `23,924,736` 字节 |
| SQLite 表数量 | `479` |
| `PRAGMA quick_check` | `ok` |

## 6. 从模拟器缓存直接导出

如果资源已经被游戏下载到本地，可以尝试：

```powershell
$hash = '4RCVLKQCRHAWT4LUD4AES5L2YAQHGU33'
$prefix = $hash.Substring(0, 2)
$remote = "/data/user/0/com.bilibili.umamusu/files/dat/$prefix/$hash"

adb -s 127.0.0.1:7555 shell ls -l $remote
adb -s 127.0.0.1:7555 pull $remote .\master.mdb.lz4
lz4.exe -d -f master.mdb.lz4 master.mdb
```

`meta` 中存在记录不代表文件一定已经落到 `files/dat`。如果 `ls` 显示文件不存在，直接使用 CDN 地址下载即可。

## 常见问题

### CDN 返回 404

依次检查：

1. 是否在游戏更新后重新导出了 `meta`
2. 哈希是否完整，前两位目录是否正确
3. URL 大小写是否与哈希一致
4. 是否选对了 `Generic`、`Manifest` 或 `Android/assetbundles` 分类
5. 是否仍在使用服务器响应中的最新 `resource_server`

### 抓包软件看不到资源请求

游戏可能使用原生网络栈、证书校验、连接复用或其他不经过普通系统代理的下载方式。定位资源时不必依赖完整抓包：

1. 从服务器响应获取 `resource_server`
2. 从本地 `files/meta` 获取资源名、哈希和大小
3. 按 URL 规则直接下载

### 安全注意事项

调试包中可能包含访问令牌、会话令牌和设备标识。文档、日志和提交记录中不要保存这些字段；如果令牌已经公开，建议重新登录使旧会话失效。
