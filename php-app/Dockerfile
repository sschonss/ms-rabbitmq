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