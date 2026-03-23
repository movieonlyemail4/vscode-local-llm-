<?php
   ini_set("date.timezone", "Asia/Kuala_Lumpur");

   header('Access-Control-Allow-Origin: *');   

   //*
   // Allow from any origin
   if (isset($_SERVER['HTTP_ORIGIN'])) {
      // Decide if the origin in $_SERVER['HTTP_ORIGIN'] is one
      // you want to allow, and if so:
      header("Access-Control-Allow-Origin: {$_SERVER['HTTP_ORIGIN']}");
      header('Access-Control-Allow-Credentials: true');
      header('Access-Control-Max-Age: 86400');    // cache for 1 day
   }

   // Access-Control headers are received during OPTIONS requests
   if ($_SERVER['REQUEST_METHOD'] == 'OPTIONS') {

      if (isset($_SERVER['HTTP_ACCESS_CONTROL_REQUEST_METHOD']))
         header("Access-Control-Allow-Methods: GET, POST, DELETE, PUT, OPTIONS");         

      if (isset($_SERVER['HTTP_ACCESS_CONTROL_REQUEST_HEADERS']))
         header("Access-Control-Allow-Headers: {$_SERVER['HTTP_ACCESS_CONTROL_REQUEST_HEADERS']}");

      exit(0);
   }
   //*/

   require_once 'vendor/autoload.php';

   use \Psr\Http\Message\ServerRequestInterface as Request;
   use \Psr\Http\Message\ResponseInterface as Response;

   use Ramsey\Uuid\Uuid;
   use Ramsey\Uuid\Exception\UnsatisfiedDependencyException;

   include_once("salt_pepper.php");
   include_once("database_class.php");  

   //load environment variable - jwt secret key
   $dotenv = new Dotenv\Dotenv(__DIR__);
   $dotenv->load();

   //jwt secret key in case dotenv not working in apache
   //$jwtSecretKey = "jwt_secret_key";

   function getDatabase() {
      $dbhost="127.0.0.1";
      $dbuser="root";
      $dbpass="";
      $dbname="fyp";

      $db = new Database($dbhost, $dbuser, $dbpass, $dbname);
      return $db;
   }

   use Slim\App;
   use Slim\Middleware\TokenAuthentication;
   use Firebase\JWT\JWT;

   function getLoginTokenPayload($request, $response) {
      $token_array = $request->getHeader('HTTP_AUTHORIZATION');
      $token = substr($token_array[0], 7);

      //decode the token
      try
      {
         $tokenDecoded = JWT::decode(
            $token, 
            getenv('JWT_SECRET'), 
            array('HS256')
         );

         //in case dotenv not working
         /*
         $tokenDecoded = JWT::decode(
            $token, 
            $GLOBALS['jwtSecretKey'], 
            array('HS256')
         );
         */
      }
      catch(Exception $e)
      {
         $data = Array(
            "jwt_status" => "token_invalid"
         ); 

         return $response->withJson($data, 401)
                         ->withHeader('Content-tye', 'application/json');
      }

      return $tokenDecoded->username;
   }

   $config = [
      'settings' => [
         'displayErrorDetails' => true
      ]
   ];

   $app = new App($config);

   $authenticator = function($request, TokenAuthentication $tokenAuth){

      /**
         * Try find authorization token via header, parameters, cookie or attribute
         * If token not found, return response with status 401 (unauthorized)
      */
      $token = $tokenAuth->findToken($request); //from header

      try {
         $tokenDecoded = JWT::decode($token, getenv('JWT_SECRET'), array('HS256'));

         //in case dotenv not working
         //$tokenDecoded = JWT::decode($token, $GLOBALS['jwtSecretKey'], array('HS256'));
      }
      catch(Exception $e) {
         throw new \app\UnauthorizedException('Invalid Token');
      }
   };

   /**
     * Add token authentication middleware
     */
   $app->add(new TokenAuthentication([
        'path' => '/', //secure route - need token
        'passthrough' => [ //public route, no token needed
            '/ping', 
            '/token', 
            '/uuid',
            '/hello',
            '/calc',
            '/registration',
            '/checkemail',
            '/auth',

         ], 
        'authenticator' => $authenticator
   ]));

   /**
     * Public route example
     */
   $app->get('/ping', function($request, $response){
      $output = ['msg' => 'RESTful API works, active and online!'];
      return $response->withJson($output, 200, JSON_PRETTY_PRINT);
   });

   $app->get('/uuid', function($request, $response) {

      try {

          // Generate a version 1 (time-based) UUID object
          //$uuid1 = Uuid::uuid1();
          //echo $uuid1->toString() . "\n"; // i.e. e4eaaaf2-d142-11e1-b3e4-080027620cdd

          // Generate a version 3 (name-based and hashed with MD5) UUID object
          $uuid3 = Uuid::uuid3(Uuid::NAMESPACE_DNS, 'php.net');
          echo $uuid3->toString() . "<br />"; // i.e. 11a38b9a-b3da-360f-9353-a5a725514269

          // Generate a version 4 (random) UUID object
          $uuid4 = Uuid::uuid4();
          echo $uuid4->toString() . "<br />"; // i.e. 25769c6c-d34d-4bfe-ba98-e0ee856f3e7a

          // Generate a version 5 (name-based and hashed with SHA1) UUID object
          $uuid5 = Uuid::uuid5(Uuid::NAMESPACE_DNS, 'php.net');
          echo $uuid5->toString() . "\n"; // i.e. c4a760a8-dbcf-5254-a0d9-6a4474bd1b62

      } catch (UnsatisfiedDependencyException $e) {

          // Some dependency was not met. Either the method cannot be called on a
          // 32-bit system, or it can, but it relies on Moontoast\Math to be present.
          echo 'Caught exception: ' . $e->getMessage() . "\n";

      }
   });

   //generate token
   //OAUTH2 token will not need this route
   $app->get('/token', function($request, $response){
      //create JWT token
      $date = date_create();
      $jwtIAT = date_timestamp_get($date);
      $jwtExp = $jwtIAT + (20 * 60); //expire after 20 minutes

      $jwtToken = array(
         "iss" => "rbk.net", //client key
         "iat" => $jwtIAT, //issued at time
         "exp" => $jwtExp, //expire
         "role" => "member",
         "email" => "email@gmail.com"
      );
      $token = JWT::encode($jwtToken, getenv('JWT_SECRET'));

      //in case dotenv not working
      //$token = JWT::encode($jwtToken, $GLOBALS['jwtSecretKey']);

      $data = array(
         'session' => true,
         'token' => $token
      );

      return $response->withJson($data, 200)
                      ->withHeader('Content-type', 'application/json');
   });

   //route with jwt token needed
   $app->get('/jwtroute', function($request, $response){

      $email = getEmailTokenPayload($request, $response);

      $data = array(
         'msg' => 'JWT Token authentication works!',
         'email' => $email
      );

      return $response->withJson($data, 200, JSON_PRETTY_PRINT);
   });

   //public route with 1 parameter
   $app->get('/hello/[{name}]', function($request, $response, $args){

      $name = $args['name'];
      $msg = "Hello $name, welcome to RESTFul world";

      $data = array(
         'msg' => $msg
      );

      return $response->withJson($data, 200, JSON_PRETTY_PRINT);
   });

   //public route with more than one parameters
   $app->get('/calc[/{num1}/{num2}]', function($request, $response, $args){

      $num1 = $args['num1'];
      $num2 = $args['num2'];
      $total = $num1 + $num2;

      $msg = "$num1 + $num2 = $total";

      $data = array(
         'msg' => $msg
      );

      return $response->withJson($data, 200, JSON_PRETTY_PRINT);
   });

   // REGISTRATION
   $app->post('/registration', function($request, $response){
      $json = json_decode($request->getBody());
      $name = $json->name;
      $username = $json->username;
      $studentid = $json->studentid;
      $clearpassword = $json->password;

      //insert user
      $db = getDatabase();
      $dbs = $db->insertUser($username, $clearpassword, $name, $studentid);
      $db->close();

      $data = array(
         "insertstatus" => $dbs->status,
         "error" => $dbs->error
      ); 

      return $response->withJson($data, 200)
                      ->withHeader('Content-type', 'application/json'); 
   });  

   /**
     * Public route /checkemail/:email for checking email availability
     * in member registration
     */
   $app->get('/checkemail/[{email}]', function($request, $response, $args){

      $email = $args['email'];

      $db = getDatabase();
      $status = $db->checkemail($email);
      $db->close();

      $data = array();

      if ($status) {
         $data = array(
            'exist' => true
         ); 
      } else {
         $data = array(
            "exist" => false
         );          
      }

      return $response->withJson($data, 200)
                      ->withHeader('Content-type', 'application/json'); 
   }); 

   
   $app->post('/auth', function($request, $response){
      //extract form data - email and password
      $json = json_decode($request->getBody());
      $username = $json->username;
      $clearpassword = $json->password;

      //do db authentication
      $db = getDatabase();
      $data = $db->authenticateUser($username);
      $db->close();

      //status -1 -> user not found
      //status 0 -> wrong password
      //status 1 -> login success

      $returndata = array(
      );

      //user not found
      if ($data === NULL) {
         $returndata = array(
            'status' => -1
         );           
      }
      //user found
      else {
         //now verify password hash - one way mdf hash using salt-peper
         
         if (pepper($clearpassword, $data->passwordhash)) {
            //correct password
      
            //create JWT token
            $date = date_create();
            $jwtIAT = date_timestamp_get($date);
            $jwtExp = $jwtIAT + (60 * 60 * 12); //expire after 12 hours

            $jwtToken = array(
               "iss" => "mycontacts.net", //token issuer
               "iat" => $jwtIAT, //issued at time
               "exp" => $jwtExp, //expire
               "role" => "member",
               "username" => $data->username
            );
            $token = JWT::encode($jwtToken, getenv('JWT_SECRET'));

            $returndata = array(
               'status' => 1,
               'token' => $token,
               'username' => $data->username,
               'studentid' => $data->studentid,
               'type' => $data->type
            );                
         } else {
            //wrong password
            $returndata = array(
               'status' => 0
            ); 
         }
      }  

      return $response->withJson($returndata, 200)
                      ->withHeader('Content-type', 'application/json');    
   }); 
   ///////////////////////////////////////////////////PROPOSAL
    //POST - INSERT PROPOSAL - secure route - need token
    $app->post('/proposal', function($request, $response){

      $ownerlogin = getLoginTokenPayload($request, $response);  
      
      $json = json_decode($request->getBody());
      $title = $json->title;
      $type = $json->type;
      $studentid = $json->studentid;

      $db = getDatabase();
      $dbs = $db->insertProposal($title, $type, $studentid);
      $db->close();

      $data = array(
        "insertstatus" => $dbs->status,
        "error" => $dbs->error
      ); 

      return $response->withJson($data, 200)
                      ->withHeader('Content-type', 'application/json'); 
    });   

    //GET - ALL PROPOSAL
    $app->get('/proposal', function($request, $response){
      $db = getDatabase();
      $data = $db->getAllProposal();
      $db->close();

      return $response->withJson($data, 200)
                      ->withHeader('Content-type', 'application/json');
   });

      //GET - SINGLE PORPOSAL VIA ID
      $app->get('/proposal/[{id}]', function($request, $response, $args){
        
        $id = $args['id'];  
        $db = getDatabase();
        $data = $db->getProposalViaId($id);
        $db->close();
        return $response->withJson($data, 200)
                        ->withHeader('Content-type', 'application/json'); 
     }); 

           //GET - SINGLE PORPOSAL VIA STUDENT ID
           $app->get('/proposalS/[{id}]', function($request, $response, $args){
        
            $id = $args['id'];  
            $db = getDatabase();
            $data = $db->getProposalViaStudentId($id);
            $db->close();
            return $response->withJson($data, 200)
                            ->withHeader('Content-type', 'application/json'); 
         }); 

      //DELETE - SINGLE PROPOSAL VIA ID
      $app->delete('/proposal/[{id}]', function($request, $response, $args){

        $id = $args['id'];
        $db = getDatabase();
        $dbs = $db->deleteProposalViaId($id);
        $db->close();
  
        $data = Array(
           "deletestatus" => $dbs->status,
           "error" => $dbs->error
        );
  
        return $response->withJson($data, 200)
                        ->withHeader('Content-type', 'application/json');     
     });

        //PUT - UPDATE SINGLE PROPOSAL VIA ID
    $app->put('/proposal/[{id}]', function($request, $response, $args){
     
    $id = $args['id'];
    $json = json_decode($request->getBody());
    $title = $json->title;
    $index = $json->index;
    $type = $json->type;
    $status = $json->status;
    $db = getDatabase();
    $dbs = $db->updateProposalViaId($id, $title, $type, $status,$index);
    $db->close();

    $data = Array(
       "updatestatus" => $dbs->status,
       "error" => $dbs->error
    );

    return $response->withJson($data, 200)
                    ->withHeader('Content-type', 'application/json');
 });

         //PUT - UPDATE SINGLE PROPOSAL VIA ID STUDENT
         $app->put('/proposalS/[{id}]', function($request, $response, $args){
     
          $id = $args['id'];
          $json = json_decode($request->getBody());
          $title = $json->title;
          $index = $json->index;
          $type = $json->type;
          $db = getDatabase();
          $dbs = $db->updateProposalSViaId($id, $title, $type,$index);
          $db->close();
          $data = Array(
             "updatestatus" => $dbs->status,
             "error" => $dbs->error
          );
      
          return $response->withJson($data, 200)
                          ->withHeader('Content-type', 'application/json');
       });
  
   ///////////////////////////////////////////////////CONTACTS
   //POST - INSERT CONTACT - secure route - need token
   $app->post('/contacts', function($request, $response){

      $ownerlogin = getLoginTokenPayload($request, $response);  
      
      //form data
      $json = json_decode($request->getBody());
      $name = $json->name;
      $email = $json->email;
      $mobileno = $json->mobileno;

      $db = getDatabase();
      $dbs = $db->insertContact($name, $email, $mobileno, $ownerlogin);
      $db->close();

      $data = array(
         "insertstatus" => $dbs->status,
         "error" => $dbs->error
      ); 

      return $response->withJson($data, 200)
                      ->withHeader('Content-type', 'application/json'); 
   });   

   //GET - ALL CONTACTS
   $app->get('/contacts', function($request, $response){

      $ownerlogin = getLoginTokenPayload($request, $response);  

      $db = getDatabase();
      $data = $db->getAllContactsViaLogin($ownerlogin);
      $db->close();

      return $response->withJson($data, 200)
                      ->withHeader('Content-type', 'application/json');
   });

   //GET - SINGLE CONTACT VIA ID
   $app->get('/contacts/[{id}]', function($request, $response, $args){

      //get owner login - to prevent rolling no hacking
      $ownerlogin = getLoginTokenPayload($request, $response);  
      
      $id = $args['id'];

      $db = getDatabase();
      $data = $db->getContactViaId($id, $ownerlogin);
      $db->close();

      return $response->withJson($data, 200)
                      ->withHeader('Content-type', 'application/json'); 
   }); 

   //PUT - UPDATE SINGLE CONTACT VIA ID
   $app->put('/contacts/[{id}]', function($request, $response, $args){
     
      $id = $args['id'];

      //form data
      $json = json_decode($request->getBody());
      $name = $json->name;
      $email = $json->email;
      $mobileno = $json->mobileno;

      $db = getDatabase();
      $dbs = $db->updateContactViaId($id, $name, $email, $mobileno);
      $db->close();

      $data = Array(
         "updatestatus" => $dbs->status,
         "error" => $dbs->error
      );

      return $response->withJson($data, 200)
                      ->withHeader('Content-type', 'application/json');
   });

   //DELETE - SINGLE CONTACT VIA ID
   $app->delete('/contacts/[{id}]', function($request, $response, $args){

      $id = $args['id'];

      $db = getDatabase();
      $dbs = $db->deleteContactViaId($id);
      $db->close();

      $data = Array(
         "deletestatus" => $dbs->status,
         "error" => $dbs->error
      );

      return $response->withJson($data, 200)
                      ->withHeader('Content-type', 'application/json');     
   });

   $app->run();