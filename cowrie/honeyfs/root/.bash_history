apt-get update
apt-get upgrade -y
systemctl status nginx
tail -f /var/log/nginx/access.log
df -h
free -m
ps aux
netstat -tulnp
uname -a
whoami
cd /var/www/html
ls -la
cat /etc/passwd
mysql -u root -p
mysqldump -u root -p mydb > backup.sql
tar -czf backup.tar.gz /var/www/html
scp backup.tar.gz user@192.168.1.10:/backups/
history
