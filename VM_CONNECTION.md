# VM Verbinding Instructies

## SSH Verbinding

### Basis Verbinding
```bash
ssh itproj@10.2.160.225
```

### Met Port Forwarding (voor RabbitMQ Management UI)
```bash
ssh -L 15673:127.0.0.1:15672 itproj@10.2.160.225
```
Na verbinding: open `http://localhost:15673` in je browser

### Vereisten
- Je moet op het EHB-netwerk zijn (campus) OF
- Verbonden via VPN

## Na Verbinding

### Navigeer naar project directory
```bash
cd ~/TestingDemo
# of
cd ~/ProjectBusinessCase
```

### Controleer project status
```bash
# Check of RabbitMQ draait
sudo systemctl status rabbitmq-server

# Check of Node.js geïnstalleerd is
node -v
npm -v

# Check of project bestaat
ls -la
```

## Handige Commando's

### RabbitMQ Management UI activeren
```bash
sudo rabbitmq-plugins enable rabbitmq_management
```

### RabbitMQ Status
```bash
sudo rabbitmq-diagnostics status
```

### Project Starten
```bash
# Terminal 1: Start API
npm run start:api

# Terminal 2: Start Consumer (nieuwe SSH sessie)
ssh itproj@10.2.160.225
cd ~/TestingDemo
npm run start:consumer
```

### Frontend Starten (optioneel)
```bash
npm run start:frontend
```
