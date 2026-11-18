#!/usr/bin/env bash
# =============================================================
# 便携 MariaDB 管理脚本
# 适用场景：本机没有 Docker、也没有安装 MySQL，但想先把系统跑起来看效果。
# 数据库完全放在用户目录下，不写注册表、不装服务，删目录即彻底清理。
#
#   bash scripts/db-local.sh init     解压 + 初始化数据目录
#   bash scripts/db-local.sh start    启动（首次会自动建库建账号）
#   bash scripts/db-local.sh stop     停止
#   bash scripts/db-local.sh status   查看状态
#
# 环境变量：IMGSTATS_DB_HOME(默认 ~/.local/imgstats-db)  IMGSTATS_DB_PORT(默认 3307)
# =============================================================
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DB_HOME="${IMGSTATS_DB_HOME:-$HOME/.local/imgstats-db}"
DB_PORT="${IMGSTATS_DB_PORT:-3307}"
DB_NAME="imgstats"
DB_USER="imgstats"
DB_PASS="imgstats_pwd"
DB_ROOT_PASS="root_local_pwd"

ZIP="$DB_HOME/mariadb.zip"
BASE="$DB_HOME/mariadb"
BIN="$BASE/bin"
DATA="$DB_HOME/data"
LOG="$DB_HOME/mysqld.log"
PIDFILE="$DB_HOME/mysqld.pid"

# msys 路径 -> Windows 路径，供 mysqld 这类原生程序使用
wpath() { cygpath -w "$1" 2>/dev/null || echo "$1"; }

find_exe() {
  for n in "$@"; do
    if [ -x "$BIN/$n.exe" ]; then echo "$BIN/$n.exe"; return 0; fi
  done
  return 1
}

need_init() { [ ! -d "$DATA/mysql" ]; }

# 首次运行时按本地端口生成 server/.env（已存在则不覆盖）
ensure_env() {
  local env="$ROOT/server/.env"
  if [ -f "$env" ]; then
    echo "    检测到 server/.env，保持原样（若连不上库，请确认 DATABASE_URL 端口为 $DB_PORT）"
    return
  fi
  cp "$ROOT/server/.env.example" "$env"
  sed -i "s|^DATABASE_URL=.*|DATABASE_URL=\"mysql://$DB_USER:$DB_PASS@127.0.0.1:$DB_PORT/$DB_NAME?connection_limit=10\&pool_timeout=20\"|" "$env"
  echo "    已生成 server/.env（数据库端口 $DB_PORT）"
}

do_init() {
  mkdir -p "$DB_HOME"
  if [ ! -x "$BIN/mysqld.exe" ]; then
    if [ ! -f "$ZIP" ]; then
      echo "缺少安装包：$ZIP"
      echo "请先下载 mariadb-*-winx64.zip 放到该路径后重试。"
      exit 1
    fi
    echo "==> 解压 $(basename "$ZIP") ..."
    mkdir -p "$BASE"
    unzip -q -o "$ZIP" -d "$BASE"
    # 压缩包内可能自带一层目录，做一次归一化
    if [ ! -x "$BIN/mysqld.exe" ]; then
      inner="$(find "$BASE" -maxdepth 2 -type d -name bin | head -1)"
      if [ -n "$inner" ]; then
        tmp="$DB_HOME/_tmp_mv"
        mv "$(dirname "$inner")" "$tmp"
        rm -rf "$BASE"
        mv "$tmp" "$BASE"
      fi
    fi
  fi

  if need_init; then
    echo "==> 初始化数据目录 $DATA ..."
    install_db="$(find_exe mariadb-install-db mysql_install_db)" || {
      echo "未找到 mariadb-install-db.exe"; exit 1;
    }
    mkdir -p "$DATA"
    "$install_db" --datadir="$(wpath "$DATA")" --password="$DB_ROOT_PASS" \
      --port="$DB_PORT" --silent
    echo "    初始化完成（root 无密码，仅监听 127.0.0.1:$DB_PORT）"
  fi
}

is_running() {
  local admin; admin="$(find_exe mariadb-admin mysqladmin)" || return 1
  "$admin" --no-defaults -h 127.0.0.1 -P "$DB_PORT" -u root -p"$DB_ROOT_PASS" ping >/dev/null 2>&1
}

do_bootstrap() {
  local cli; cli="$(find_exe mariadb mysql)" || { echo "未找到 mysql 客户端"; exit 1; }
  "$cli" --no-defaults -h 127.0.0.1 -P "$DB_PORT" -u root -p"$DB_ROOT_PASS" <<SQL
CREATE DATABASE IF NOT EXISTS \`$DB_NAME\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS '$DB_USER'@'%' IDENTIFIED BY '$DB_PASS';
CREATE USER IF NOT EXISTS '$DB_USER'@'localhost' IDENTIFIED BY '$DB_PASS';
GRANT ALL PRIVILEGES ON \`$DB_NAME\`.* TO '$DB_USER'@'%';
GRANT ALL PRIVILEGES ON \`$DB_NAME\`.* TO '$DB_USER'@'localhost';
FLUSH PRIVILEGES;
SQL
}

do_start() {
  do_init
  if is_running; then
    echo "MariaDB 已在运行：127.0.0.1:$DB_PORT"
  else
    local mysqld; mysqld="$(find_exe mariadbd mysqld)" || { echo "未找到 mysqld.exe"; exit 1; }
    echo "==> 启动 MariaDB (127.0.0.1:$DB_PORT) ..."
    # Start-Process：让 mysqld 完全脱离当前终端，父 shell 退出后仍继续运行
    local args
    args=$(printf '%s ' \
      "--no-defaults" \
      "--datadir=\"$(wpath "$DATA")\"" \
      "--port=$DB_PORT" "--bind-address=127.0.0.1" \
      "--character-set-server=utf8mb4" "--collation-server=utf8mb4_unicode_ci" \
      "--skip-name-resolve" "--innodb-buffer-pool-size=128M" \
      "--log-error=\"$(wpath "$LOG")\"")
    powershell -NoProfile -Command \
      "Start-Process -FilePath '$(wpath "$mysqld")' -ArgumentList '$args' -WindowStyle Hidden" >/dev/null

    for _ in $(seq 1 60); do
      if is_running; then break; fi
      sleep 1
    done
    if ! is_running; then
      echo "启动失败，日志末尾："; tail -20 "$LOG" 2>/dev/null || true; exit 1
    fi
  fi
  do_bootstrap
  ensure_env
  echo "==> 数据库就绪"
  echo "    DATABASE_URL=\"mysql://$DB_USER:$DB_PASS@127.0.0.1:$DB_PORT/$DB_NAME\""
}

do_stop() {
  local admin; admin="$(find_exe mariadb-admin mysqladmin)" || exit 1
  if is_running; then
    "$admin" --no-defaults -h 127.0.0.1 -P "$DB_PORT" -u root -p"$DB_ROOT_PASS" shutdown || true
    echo "已停止"
  else
    echo "未在运行"
  fi
}

case "${1:-start}" in
  init)   do_init; echo "初始化完成" ;;
  start)  do_start ;;
  stop)   do_stop ;;
  status) if is_running; then echo "running: 127.0.0.1:$DB_PORT"; else echo "stopped"; fi ;;
  *) echo "用法: $0 {init|start|stop|status}"; exit 1 ;;
esac
