<?php

   class User {
      var $id;
      var $login;
      var $name;
      var $email;
      var $mobileno;
      var $photo;
      var $username;
      var $studentid;
      var $type;
   }

   class Contact {
      var $id;
      var $name;
      var $email;
      var $mobileno;
      var $photo;
      var $addeddate;
      var $status;
   }
   class Proposal {
        var $id;
        var $studentid;
        var $title;
        var $type;
        var $status;
     }

   class DbStatus {
      var $status;
      var $error;
      var $lastinsertid;
   }

   function time_elapsed_string($datetime, $full = false) {

      if ($datetime == '0000-00-00 00:00:00')
         return "none";

      if ($datetime == '0000-00-00')
         return "none";

      $now = new DateTime;
      $ago = new DateTime($datetime);
      $diff = $now->diff($ago);

      $diff->w = floor($diff->d / 7);
      $diff->d -= $diff->w * 7;

      $string = array(
         'y' => 'year',
         'm' => 'month',
         'w' => 'week',
         'd' => 'day',
         'h' => 'hour',
         'i' => 'minute',
         's' => 'second',
      );
      
      foreach ($string as $k => &$v) {
         if ($diff->$k) {
            $v = $diff->$k . ' ' . $v . ($diff->$k > 1 ? 's' : '');
         } else {
            unset($string[$k]);
         }
      }

      if (!$full) $string = array_slice($string, 0, 1);
         return $string ? implode(', ', $string) . ' ago' : 'just now';
   }

	class Database {
 		protected $dbhost;
    	protected $dbuser;
    	protected $dbpass;
    	protected $dbname;
    	protected $db;

 		function __construct( $dbhost, $dbuser, $dbpass, $dbname) {
   		$this->dbhost = $dbhost;
   		$this->dbuser = $dbuser;
   		$this->dbpass = $dbpass;
   		$this->dbname = $dbname;

   		$db = new PDO("mysql:host=$dbhost;dbname=$dbname", $dbuser, $dbpass);
    		$db->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
			$db->setAttribute(PDO::ATTR_EMULATE_PREPARES, false);
         $db->setAttribute(PDO::MYSQL_ATTR_FOUND_ROWS, true);
    		$this->db = $db;
   	}

      function beginTransaction() {
         try {
            $this->db->beginTransaction(); 
         }
         catch(PDOException $e) {
            $errorMessage = $e->getMessage();
            return 0;
         } 
      }

      function commit() {
         try {
            $this->db->commit();
         }
         catch(PDOException $e) {
            $errorMessage = $e->getMessage();
            return 0;
         } 
      }

      function rollback() {
         try {
            $this->db->rollback();
         }
         catch(PDOException $e) {
            $errorMessage = $e->getMessage();
            return 0;
         } 
      }

      function close() {
         try {
            $this->db = null;   
         }
         catch(PDOException $e) {
            $errorMessage = $e->getMessage();
            return 0;
         } 
      }

      //insert user
      function insertUser($username, $clearpassword, $name, $studentid) {

         //hash the password using one way md5 hashing
         $passwordhash = salt($clearpassword);
  
         try {
            
            $sql = "INSERT INTO users(username, password, name, studentid, addeddate,type) 
                    VALUES (:username, :password, :name, :studentid, NOW(),'student')";

            $stmt = $this->db->prepare($sql);  
            $stmt->bindParam("username", $username);
            $stmt->bindParam("password", $passwordhash);
            $stmt->bindParam("name", $name);
            $stmt->bindParam("studentid", $studentid);
 
            $stmt->execute();

            $dbs = new DbStatus();
            $dbs->status = true;
            $dbs->error = "none";
            $dbs->lastinsertid = $this->db->lastInsertId();

            return $dbs;
         }
         catch(PDOException $e) {
            $errorMessage = $e->getMessage();

            $dbs = new DbStatus();
            $dbs->status = false;
            $dbs->error = $errorMessage;

            return $dbs;
         } 
      }

      function checkemail($email) {
         $sql = "SELECT *
                 FROM users
                 WHERE email = :email";

         $stmt = $this->db->prepare($sql);
         $stmt->bindParam("email", $email);
         $stmt->execute(); 
         $row_count = $stmt->rowCount();
         return $row_count;
      }


      function authenticateUser($username) {
         $sql = "SELECT studentid,username,type, password as passwordhash
                 FROM users
                 WHERE username = :username";        

         $stmt = $this->db->prepare($sql);
         $stmt->bindParam("username", $username);
         $stmt->execute(); 
         $row_count = $stmt->rowCount(); 

         $user = null;

         if ($row_count) {
            while($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
               $user = new User();
               $user->username= $row['username'];
               $user->studentid= $row['studentid'];
               $user->passwordhash = $row['passwordhash'];
               $user->type = $row['type'];
            }
         }

         return $user;
      }
      /////////////////////////////////////////////////////////////////////////////////// proposal
      function insertProposal($title, $type, $studentid) {

        try {
           
           $sql = "INSERT INTO proposal(title, type, studentid, status) 
                   VALUES (:title, :type, :studentid, :status)";
           $status = "Pending";
           $stmt = $this->db->prepare($sql);  
           $stmt->bindParam("title", $title);
           $stmt->bindParam("type", $type);
           $stmt->bindParam("studentid", $studentid);
           $stmt->bindParam("status", $status);
           $stmt->execute();

           $dbs = new DbStatus();
           $dbs->status = true;
           $dbs->error = "none";
           $dbs->lastinsertid = $this->db->lastInsertId();

           return $dbs;
        }
        catch(PDOException $e) {
           $errorMessage = $e->getMessage();

           $dbs = new DbStatus();
           $dbs->status = false;
           $dbs->error = $errorMessage;

           return $dbs;
        }          
     }
        //get all proposal
        function getAllProposal() {
        $sql = "SELECT *
                FROM proposal";
        $stmt = $this->db->prepare($sql);
        $stmt->execute(); 
        $row_count = $stmt->rowCount();
        $data = array();
        if ($row_count)
        {
           while($row = $stmt->fetch(PDO::FETCH_ASSOC))
           {
              $proposal = new Proposal();
              $proposal->id = $row['id'];
              $proposal->studentid = $row['studentid'];
              $proposal->title = $row['title'];
              $proposal->type = $row['type'];
              $proposal->status = $row['status'];       

              array_push($data, $proposal);
           }
        }

        return $data;
        }

        //get single proposal
      function getProposalViaId($id) {
        $sql = "SELECT *
                FROM proposal
                WHERE id = :id";

        $stmt = $this->db->prepare($sql);
        $stmt->bindParam("id", $id);
        $stmt->execute(); 
        $row_count = $stmt->rowCount();

        $proposal = new Proposal();

        if ($row_count)
        {
           while($row = $stmt->fetch(PDO::FETCH_ASSOC))
           {               
                $proposal->id = $row['id'];
                $proposal->studentid = $row['studentid'];
                $proposal->title = $row['title'];
                $proposal->type = $row['type'];
                $proposal->status = $row['status'];   
           }
        }

        return $proposal;
     }

            //get single proposal via student id
            function getProposalViaStudentId($id) {
                $sql = "SELECT *
                        FROM proposal
                        WHERE studentid = :id";
        
                $stmt = $this->db->prepare($sql);
                $stmt->bindParam("id", $id);
                $stmt->execute(); 
                $row_count = $stmt->rowCount();
                $data = array();
                $proposal = new Proposal();
        
                if ($row_count)
                {
                   while($row = $stmt->fetch(PDO::FETCH_ASSOC))
                   {
                      $proposal = new Proposal();
                      $proposal->id = $row['id'];
                      $proposal->studentid = $row['studentid'];
                      $proposal->title = $row['title'];
                      $proposal->type = $row['type'];
                      $proposal->status = $row['status'];       
        
                      array_push($data, $proposal);
                   }
                }
        
                return $data;
                }

          //delete proposal via id
          function deleteProposalViaId($id) {

                $dbstatus = new DbStatus();
       
                $sql = "DELETE 
                        FROM proposal 
                        WHERE id = :id";
       
                try {
                   $stmt = $this->db->prepare($sql); 
                   $stmt->bindParam("id", $id);
                   $stmt->execute();
       
                   $dbstatus->status = true;
                   $dbstatus->error = "none";
                   return $dbstatus;
                }
                catch(PDOException $e) {
                   $errorMessage = $e->getMessage();
       
                   $dbstatus->status = false;
                   $dbstatus->error = $errorMessage;
                   return $dbstatus;
                }           
             }
             
             function updateProposalViaId($id, $title, $type, $status,$index) {

                $sql = "UPDATE proposal
                        SET title = :title,
                            type = :type,
                            status = :status
                        WHERE id = :index";
       
                try {
                   $stmt = $this->db->prepare($sql);  
                   $stmt->bindParam("title", $title);
                   $stmt->bindParam("type", $type);
                   $stmt->bindParam("status", $status);
                   $stmt->bindParam("index", $index);
                   $stmt->execute();
       
                   $dbs = new DbStatus();
                   $dbs->status = true;
                   $dbs->error = "none";
       
                   return $dbs;
                }
                catch(PDOException $e) {
                   $errorMessage = $e->getMessage();
       
                   $dbs = new DbStatus();
                   $dbs->status = false;
                   $dbs->error = $errorMessage;
       
                   return $dbs;
                } 
             } 

             function updateProposalSViaId($id, $title, $type,$index) {

                $sql = "UPDATE proposal
                        SET title = :title,
                            type = :type
                        WHERE id = :index";
       
                try {
                   $stmt = $this->db->prepare($sql);  
                   $stmt->bindParam("title", $title);
                   $stmt->bindParam("type", $type);
                   $stmt->bindParam("index", $index);
                   $stmt->execute();
                   $dbs = new DbStatus();
                   $dbs->status = true;
                   $dbs->error = "none";
                   return $dbs;
                }
                catch(PDOException $e) {
                   $errorMessage = $e->getMessage();
       
                   $dbs = new DbStatus();
                   $dbs->status = false;
                   $dbs->error = $errorMessage;
       
                   return $dbs;
                } 
             } 

   }