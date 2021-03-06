var pureelkApp = angular.module('pureelk', ['ngRoute', 'ngResource'])
    .config(function ($routeProvider, $resourceProvider) {
                $routeProvider
                    .when('/flasharrays',
                    {
                        controller: 'FlashArraysController',
                        templateUrl: '/webapp/partials/flasharrays.html'
                    })
                    .otherwise({redirectTo: '/flasharrays'});

                // Stop AngularJS from removing the slash at the end of URL. pureelk REST server
                // needs the /
                $resourceProvider.defaults.stripTrailingSlashes = false;
            })
    .factory('PureElkRestService', function ($resource) {
                 return $resource({}, {}, {
                     getArrays: {
                         method: 'GET',
                         url: 'rest/arrays/',
                         isArray: true
                     },
                     deleteArray: {
                         method: 'DELETE',
                         url: 'rest/arrays/:arrayid'
                     },
                     addArray: {
                         method: 'POST',
                         url: 'rest/arrays/',
                         headers: {'Content-Type': 'application/json'}
                     },
                     updateArray: {
                         method: 'PUT',
                         url: 'rest/arrays/:arrayid',
                         headers: {'Content-Type': 'application/json'}
                     },
                     changeArrayCollectionStatus: {
                         method: 'PUT',
                         url: 'rest/arrays/:arrayid'
                     }
                 });
             })
    .controller('FlashArraysController',
                function ($scope, $log, $location, $window, $interval, PureElkRestService) {
                    $log.info('in FlashArrayController')

                    // initialize momentjs
                    moment().format();

                    $scope.deleteArray = function (array_id) {
                        PureElkRestService.deleteArray({arrayid: array_id});
                        $scope.reloadArray();
                    };

                    $scope.isCollecting = function(array) {
                        return array.hasOwnProperty('enabled') ? array.enabled : true;
                    }

                    $scope.getCollectionStatus = function(array) {
                        if (!array.task_state)
                            return "NOT STARTED";
                        if (!$scope.isCollecting(array))
                            return "PAUSED";
                        return array.task_state;
                    }

                    $scope.changeArrayCollectionStatus = function (array) {
                        // array context has "enabled=true" by default if "enabled" property doesn't exist
                        isEnabled = $scope.isCollecting(array);

                        // change collection status to opposite
                        array.enabled = !isEnabled;
                        PureElkRestService.changeArrayCollectionStatus({arrayid:array.id}, {enabled : array.enabled});
                        $log.info("Changed array collection status to " + array.enabled);
                    }


                    $scope.resetNewArray = function() {
                        $scope.newarray = { data_ttl : "90", frequency: "60" };
                        $scope.newarrayError = {};
                    }

                    $scope.setupArrayAdd = function() {
                        $scope.resetNewArray();
                    }

                    $scope.addArray = function () {
                        $log.info('Adding array: ' + $scope.newarray.host);

                        // make a quick clone of the new array object and modify the TTL to add 'days'
                        var cloneOfNewArray = JSON.parse(JSON.stringify($scope.newarray));
                        cloneOfNewArray.data_ttl = cloneOfNewArray.data_ttl + 'd';

                        PureElkRestService.addArray(angular.toJson(cloneOfNewArray)).$promise.then(function(data){
                            // success handler
                            $('#modalNewArray').modal('hide');
                            $scope.reloadArray();
                        }, function(error) {
                            if (error.data.message.indexOf("Invalid argument") > -1) {
                                $scope.newarrayError.message = "Unreachable FlashArray hostname, please try again."
                            } else if (error.data.message.indexOf("invalid credentials") > -1) {
                                $scope.newarrayError.message = "Invalid credentials, please try again."
                            } else {
                                $scope.newarrayError.message = error.data.message;
                            }
                        });
                    }

                    $scope.reloadArray = function () {
                        PureElkRestService.getArrays().$promise.then(function(arrayData) {
                           $scope.flasharrays = arrayData;
                        });
                    }

                    $scope.reloadArray();
                    $interval($scope.reloadArray, 5000);

                    // every second go in there to update the flasharray updated time (seconds ago)
                    $interval(function(){
                        for (var flasharray in $scope.flasharrays) {
                            flasharray.refresh_seconds_ago = Math.floor(new Date().getTime() / 1000 - flasharray.task_timestamp)
                        }
                    }, 1000)

                    $scope.getUpdatedAgo = function (epoch) {
                        if (!epoch)
                            return "-";

                        return moment.unix(epoch).fromNow();
                    }

                    $scope.kibanaURL =
                        $location.protocol() + "://" + $location.host() + ":5601/";

                    $scope.setupArrayEdit = function(flasharray) {
                        // set up a copy of the array to bind into the "edit array" view.
                        var editarray = $.extend(true, {}, flasharray);

                        // The backend doesn't persist password. We just set the array id there as a fake password
                        editarray.password = flasharray.id;
                        if (!!flasharray.data_ttl)
                        {
                            // Need to trim away the day unit string "d".
                            editarray.data_ttl = flasharray.data_ttl.substring(0, flasharray.data_ttl.length - 1);
                        }

                        $scope.arrayEdit = {
                            original: flasharray,
                            edit: editarray
                        };

                        $scope.editarrayError = {};
                    }

                    $scope.updateArray = function() {
                        $log.info('Updating array: ' + $scope.arrayEdit.original.id);
                        var original = $scope.arrayEdit.original;
                        var edit = JSON.parse(JSON.stringify($scope.arrayEdit.edit));

                        edit.data_ttl = edit.data_ttl + 'd';

                        // If username or password didn't change, we skip them so that server will not refresh the api token.
                        // Note that we use id to fake the password when setting up the edit dialog.
                        if (edit.username == original.username && edit.password == original.id)
                        {
                            delete edit.username;
                            delete edit.password;
                        }

                        PureElkRestService.updateArray({arrayid: edit.id}, angular.toJson(edit))
                            .$promise.then(function(data){
                                // success handler
                                $('#modalEditArray').modal('hide');
                                $scope.reloadArray();
                            }, function(error) {
                                $scope.editarrayError.message = error.data.message;
                            });
                    }
                });