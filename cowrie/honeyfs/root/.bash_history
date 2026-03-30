apt-get update
apt-get upgrade -y
systemctl status nginx
systemctl restart nginx
tail -f /var/log/nginx/access.log
tail -f /var/log/nginx/error.log
df -h
free -m
ps aux
netstat -tulnp
ss -tulnp
uname -a
whoami
cd /var/www/html
ls -la
cat .env
mysql -u root -p
mysqldump -u root -p production_db > /opt/backups/prod_$(date +%Y%m%d).sql
tar -czf /opt/backups/html_$(date +%Y%m%d).tar.gz /var/www/html
cd /root
cat .aws/credentials
aws s3 ls s3://prod-srv-backups
aws s3 cp /opt/backups/ s3://prod-srv-backups/ --recursive
history
exit
