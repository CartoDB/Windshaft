Version 0.4.12-dev
2012-??-??

 - Include database username in renderer cache key (#43)

Version 0.4.11
2012-08-14

 - Properly encode errors in DELETE responses
 - Send CORS headers with all responses, add doCORS() function
 - Add beforeStateChange called on POST and DELETE style request

Version 0.4.10
2012-08-07

 - Expose setStyle and delStyle methods
 - Add afterStyleChange and afterStyleDelete callbacks

Version 0.4.9
2012-07-18

 - Allow using with grainstore 0.3.0 to support overriding
   database access credentials
 - Add "clean" and "all" rules
   

Version 0.4.8
2012-07-04

 - Encode dependency on node-0.4
 - Raise express dependency to 2.5.11 (supports node-0.6)
 - Prepare code to support express-3.0 
 - Redis dependency raised from 0.6.7 to 0.7.2 (supports node-0.8)
 - Require grainstore 0.2.3  (supports node-0.8)
 - Require zlib module as a workaround to "express"
   requiring a version of "connect" which doesn't do so
   while it should (https://github.com/senchalabs/connect/issues/613)
 - Testsuite enhancements
   - Read connection params from environment also at preparation time
   - Better handling of database preparation failures
   - Require mocha 1.2.1 as 1.2.2 doesn't work with node-0.4
     See https://github.com/visionmedia/mocha/issues/489 

Version 0.4.7
2012-06-26

 - Testsuite enhancements
   - Run on "make check"
   - Ported to mocha
   - Do not hang anymore
   - Fix invalid MML syntax
   - More verbose failures
 - Improved documentation 
 - Raise grainstore dependency to 0.2.2

Version 0.4.6
2012-05-07

Version 0.4.5
2012-04-23

Version 0.4.4
2012-04-01

Version 0.4.3
2011-12-14

Version 0.4.2
2011-12-09

Version 0.4.1
2011-12-09

Version 0.4.0
2011-12-08

Version 0.3.2
2011-11-30

Version 0.3.1
2011-11-25

Version 0.3.0
2011-10-13

Version 0.2.6
2011-10-07

Version 0.2.5
2011-10-07

Version 0.2.4
2011-10-07

Version 0.2.3
2011-10-07

Version 0.2.1
2011-10-07

Version 0.0.11
2011-09-20

Version 0.0.10
2011-09-20

Version 0.0.9
2011-09-20

Version 0.0.8
2011-09-14

Version 0.0.7
2011-09-14

Version 0.0.6
2011-09-14

Version 0.0.5
2011-09-06

Version 0.0.4
2011-09-04

Version 0.0.3
2011-09-04

Version 0.0.2
2011-09-04

