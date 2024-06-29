# Microservices e Mensageria com PHP, NodeJS, RabbitMQ e Docker

O desenvolvimento de microserviços é uma abordagem arquitetural que estrutura uma aplicação como um conjunto de serviços pequenos e independentes, que são executados em seu próprio processo e se comunicam por meio de protocolos leves, como HTTP, WebSockets ou AMQP.

Neste artigo, vamos criar uma aplicação de microserviços com PHP, RabbitMQ e Docker. O RabbitMQ é um software de mensageria que implementa o protocolo AMQP (Advanced Message Queuing Protocol), que é um protocolo de mensagens assíncronas.

## O que é RabbitMQ?

Vamos imaginar o seguinte cenário: você tem um sistema que precisa enviar e-mails para os usuários. Em vez de enviar os e-mails diretamente, você pode enviar uma mensagem para uma fila de mensagens, que será consumida por um serviço que envia os e-mails. Isso é o que o RabbitMQ faz: ele recebe mensagens de produtores e as envia para consumidores.

Dessa forma é possível desacoplar a produção de mensagens do consumo, o que permite escalar cada parte do sistema de forma independente. Além disso, o RabbitMQ garante que as mensagens sejam entregues na ordem correta e que não sejam perdidas.

## Arquitetura da aplicação

Nossa aplicação será composta por dois microserviços: um produtor e um consumidor. O produtor será responsável por enviar mensagens para uma fila de mensagens, e o consumidor será responsável por consumir as mensagens e exibi-las no terminal.

Nosso primeiro passo será criar o arquivo `docker-compose.yml` para definir os serviços da nossa aplicação:

```yaml
services:
  rabbitmq:
    image: "rabbitmq:3-management"
    container_name: "rabbitmq"
    ports:
      - "15672:15672"
      - "5672:5672"

  php-app:
    build: ./php-app
    depends_on:
      - rabbitmq

  node-app:
    build: ./node-app
    depends_on:
      - rabbitmq
```

Neste arquivo, definimos três serviços: `rabbitmq`, `php-app` e `node-app`. O serviço `rabbitmq` é baseado na imagem `rabbitmq:3-management`, que inclui a interface de gerenciamento do RabbitMQ. Os serviços `php-app` e `node-app` são baseados em imagens customizadas que iremos criar.

---

### Criando o produtor com PHP

Agora, vamos criar o diretório `php-app` e o arquivo `Dockerfile` dentro dele:

```bash
$ mkdir php-app
$ touch php-app/Dockerfile
```

No arquivo `Dockerfile`, vamos definir a imagem base e copiar os arquivos da aplicação:

```Dockerfile
FROM php:7.4-cli
 
RUN apt-get update && apt-get install -y librabbitmq-dev libssl-dev git unzip wget curl

RUN docker-php-ext-install sockets pdo pdo_mysql
RUN pecl install amqp && docker-php-ext-enable amqp

COPY . /usr/src/myapp
WORKDIR /usr/src/myapp

RUN curl -sS https://getcomposer.org/installer | php -- --install-dir=/usr/local/bin --filename=composer

RUN composer clear-cache

RUN composer install

CMD ["php", "./publisher.php"]
```

Neste arquivo, definimos a imagem base `php:7.4-cli` e instalamos as dependências necessárias para o RabbitMQ e o Composer. Em seguida, copiamos os arquivos da aplicação para o diretório `/usr/src/myapp`, instalamos as dependências do Composer e executamos o script `publisher.php`.

Agora, vamos criar o arquivo `publisher.php` na raiz do projeto:

```php
<?php
require_once __DIR__ . '/vendor/autoload.php';
use PhpAmqpLib\Connection\AMQPStreamConnection;
use PhpAmqpLib\Message\AMQPMessage;

$maxRetries = 5; 
$retryDelay = 5; 

for ($attempt = 0; $attempt < $maxRetries; $attempt++) {
    try {
        $connection = new AMQPStreamConnection('rabbitmq', 5672, 'guest', 'guest');
        $channel = $connection->channel();
        break;
    } catch (Exception $e) {
        echo "Failed to connect to RabbitMQ. Retrying in $retryDelay seconds...\n";
        sleep($retryDelay);
    }
}

if (!isset($connection)) {
    echo "Not possible to connect to RabbitMQ. Exiting...\n The application will be restarted by Docker\n";
    exit(1);
}

$channel->queue_declare('hello', false, false, false, false);

$msg = new AMQPMessage('Hello, RabbitMQ! Now is ' . date('Y-m-d H:i:s'));
$channel->basic_publish($msg, '', 'hello');

echo " [x] Sent 'Hello, RabbitMQ!'\n";

$channel->close();
$connection->close();
```

Neste arquivo, criamos uma conexão com o RabbitMQ, declaramos uma fila chamada `hello` e enviamos uma mensagem para essa fila. Em seguida, fechamos a conexão com o RabbitMQ.

Perceba que estamos tentando conectar ao RabbitMQ várias vezes, com um intervalo de 5 segundos entre as tentativas. Isso é importante para garantir que a aplicação consiga se conectar ao RabbitMQ mesmo que ele não esteja disponível imediatamente.

Isso é uma prática comum em aplicações distribuídas, onde a disponibilidade dos serviços pode variar ao longo do tempo, pesquise mais sobre `circuit breaker` e `retry pattern`.

Mas para instalar as dependências do RabbitMQ e do Composer, precisamos criar o arquivo `composer.json` na raiz do projeto:

```json
{
  "require": {
    "php-amqplib/php-amqplib": "^3.1",
    "phpseclib/phpseclib": "^3.0"
  }
}
```
---

### Criando o consumidor com Node.js

Agora, vamos criar o diretório `node-app` e o arquivo `Dockerfile` dentro dele:

```bash
$ mkdir node-app
$ touch node-app/Dockerfile
```

No arquivo `Dockerfile`, vamos definir a imagem base e copiar os arquivos da aplicação:

```Dockerfile
FROM node:14

WORKDIR /usr/src/app

COPY package*.json ./
RUN npm install

COPY . .

CMD ["node", "subscriber.js"]
```

Neste arquivo, definimos a imagem base `node:14`, copiamos os arquivos da aplicação para o diretório `/usr/src/app`, instalamos as dependências do Node.js e executamos o script `subscriber.js`.

Agora, vamos criar o arquivo `subscriber.js` na raiz do projeto:

```javascript
const amqp = require('amqplib');

async function connectWithRetry() {
  const maxRetries = 5;  
  const retryDelay = 5000; 

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const connection = await amqp.connect('amqp://rabbitmq');
      return connection;
    } catch (err) {
      console.error(`Not possible to connect to RabbitMQ. Retrying in ${retryDelay}ms. Attempt ${attempt} of ${maxRetries}.`);
      await new Promise(resolve => setTimeout(resolve, retryDelay));
    }
  }

  throw new Error(`Failed to connect to RabbitMQ after ${maxRetries} attempts`);
}

async function receiveMessages() {
  try {
    const connection = await connectWithRetry();
    const channel = await connection.createChannel();

    const queue = 'hello';
    await channel.assertQueue(queue, { durable: false });

    console.log(" [*] Waiting for messages in %s.", queue);
    channel.consume(queue, function(msg) {
      console.log(" [x] Received: %s", msg.content.toString());
    }, {
        noAck: true
    });
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }
}

receiveMessages();
```

Neste arquivo, criamos uma conexão com o RabbitMQ, declaramos uma fila chamada `hello` e consumimos as mensagens dessa fila. Em seguida, exibimos as mensagens no terminal.

Assim como no produtor, estamos tentando conectar ao RabbitMQ várias vezes, com um intervalo de 5 segundos entre as tentativas. Isso é importante para garantir que o consumidor consiga se conectar ao RabbitMQ mesmo que ele não esteja disponível imediatamente.

E para instalar as dependências do RabbitMQ, precisamos criar o arquivo `package.json` na raiz do projeto:

```json
{
  "name": "node-app",
  "version": "1.0.0",
  "description": "",
  "main": "subscriber.js",
  "dependencies": {
    "amqplib": "^0.8.0"
  },
  "author": "",
  "license": "ISC"
}
```

---

### Executando a aplicação

Agora que criamos os serviços do RabbitMQ, do produtor e do consumidor, vamos executar a aplicação com o Docker Compose:

```bash
$ docker-compose up --build
```

Isso irá criar os containers dos serviços e executar a aplicação. Você verá as mensagens enviadas pelo produtor sendo exibidas no terminal pelo consumidor.

O RabbitMQ também estará disponível na porta 15672, onde você pode acessar a interface de gerenciamento e visualizar as filas e as mensagens.

Com isso, criamos uma aplicação de microserviços com PHP, RabbitMQ e Docker. Essa abordagem arquitetural permite escalar cada parte do sistema de forma independente e garante a entrega das mensagens na ordem correta.

Espero que este artigo tenha sido útil e que você possa aplicar esses conceitos em seus projetos. Se tiver alguma dúvida ou sugestão, deixe nos comentários.

Qualquer dúvida, estou à disposição.

Link do Repositório: [Microservices e Mensageria com PHP, RabbitMQ e Docker](#)

