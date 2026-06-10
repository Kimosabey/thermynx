@echo off
:: Wrapper script for Grafana CLI running inside Docker
:: Usage: scripts\grafana_cli.bat <commands>
:: Example: scripts\grafana_cli.bat plugins ls

docker compose --profile obs exec grafana grafana cli %*
