var map;
var distanceMatrixService;
var directionsService;
var directionsDisplay;
var bestPolyline;
var curPolyline;

var markers = [];
var locations = [];
var distanceMatrix;


function initMap() {
	map = new google.maps.Map(document.getElementById('map'), {
		center: {lat: -34.397, lng: 150.644},
		zoom: 8
	});

	google.maps.event.addListener(map, 'click', function(event) {

		if (markers.length <= 10) {
			var marker = new google.maps.Marker({
		    	position: event.latLng,
		    	map: map
		  	});

		  	markers.push(marker);
		  	locations.push(event.latLng);
		} else {
			alert("Number of destinations cannot exceed 10.");
		}
	});

	distanceMatrixService = new google.maps.DistanceMatrixService();
	directionsService = new google.maps.DirectionsService();
	directionsDisplay = new google.maps.DirectionsRenderer();

	bestPolyline = new google.maps.Polyline({
  		strokeColor: '#FF0000',
  		strokeOpacity: 1.0,
  		strokeWeight: 3,
  		map: map,
	});

	curPolyline = new google.maps.Polyline({
  		strokeColor: '#2F8C8E',
  		strokeOpacity: 1.0,
  		strokeWeight: 3,
  		map: map,
	});
}

function runGA() {
	var ga = new GA();
	var population = new Population(50, true);
	var best = population.getFittest();
	var startTime = population.getFittest().getDistance();
	$("#start").html(startTime + " seconds");
	$("#end").html(startTime + " seconds");
	var endTime;
	bestPolyline.setMap(map);
	curPolyline.setMap(map);
	var i = 0;
	var ticker = setInterval(function() {
		population = ga.evolvePopulation(population);
		localBest = population.getFittest();
		if (localBest.getFitness() > best.getFitness()) {
			best = localBest;
			$("#end").html(best.getDistance() + " seconds");
		}
		bestPolyline.setPath(best.getPath());
		var ind = Math.floor(Math.random() * markers.length);
		curPolyline.setPath(population.tours[ind].getPath());
		if (i == 75) {
			clearMarkersAndPolylines();
			runDirectionsService(best.getPath());
			clearInterval(ticker);
		}
		i++;
	}, 250);
}

function runDistanceMatrixService() {
	distanceMatrixService.getDistanceMatrix({
		origins: locations,
		destinations: locations,
		travelMode: 'DRIVING',
		avoidHighways: false,
		avoidTolls: false
	}, distanceMatrixCallback);
}

function distanceMatrixCallback(response, status) {
	if (status == 'OK') {
		console.log("Callback accessed");
		distanceMatrix = new DistanceMatrix(response);
		runGA();
	}
}

function runDirectionsService(path) {
	directionsDisplay.setMap(map);
	var start = path[0];
	var end = path[path.length - 1];
	var waypts = [];
	for (var i = 1; i < path.length - 1; i++) {
		waypts.push({
			location: path[i],
			stopover: true
		});
	}
	var request = {
		origin:start,
		destination:end,
		travelMode: 'DRIVING',
		waypoints: waypts
	};
	directionsService.route(request, function(response, status) {
		if (status == 'OK') {
		  directionsDisplay.setDirections(response);
		} else {
			alert("Direction request failed due to " + status);
			clearMap();
		}
	});
}

function clearMarkersAndPolylines() {
	for (var i = 0; i < markers.length; i++) {
		markers[i].setMap(null);
	}
	markers = [];

	bestPolyline.setMap(null);
	curPolyline.setMap(null);
}

function clearDirections() {
	locations = [];
	directionsDisplay.setMap(null);	
}

function clearMap() {
	clearMarkersAndPolylines();
	clearDirections();
}

function shuffle(a) {
    var j, x, i;
    for (i = a.length; i; i--) {
        j = Math.floor(Math.random() * i);
        x = a[i - 1];
        a[i - 1] = a[j];
        a[j] = x;
    }
}

function DistanceMatrix(matrix) {
	this.matrix = matrix;
	this.getDistance = function(x, y) {
		return this.matrix.rows[x].elements[y].distance.value;
	}
	this.getDuration = function(x, y) {
		return this.matrix.rows[x].elements[y].duration.value;
	}
}

function Tour() {
	this.tour = [];
	for (var i = 0; i < markers.length; i++) {
		this.tour.push(null);
	}
	this.distance = 0;
	this.fitness = 0;
	this.generateIndividual = function() {
		for (var i = 0; i < markers.length; i++) {
			this.tour[i] = i;
		}
		shuffle(this.tour);
	}
	this.getDistance = function() {
		if (this.distance == 0) {
			var tourDistance = 0;
			for (var i = 0; i < this.tour.length; i++) {
				var x = this.tour[i];
				var y = this.tour[(i + 1) % this.tour.length];
				tourDistance += distanceMatrix.getDuration(x, y);
			}
			this.distance = tourDistance;
		}
		return this.distance;
	}
	this.getFitness = function() {
		if (this.fitness == 0) {
			return 1 / this.getDistance();
		}
		return this.fitness;
	}
	this.containsMarker = function(marker) {
		for (var i = 0; i < this.tour.length; i++) {
			if (this.tour[i] == marker) {
				return true;
			}
		}
		return false;
	}
	this.getPath = function() {
		var path = [];
		for (var i = 0; i < this.tour.length; i++) {
			path.push(locations[this.tour[i]]);
		}
		return path;
	}
}

function Population(size, initialize) {
	this.tours = [];
	for (var i = 0; i < size; i++) {
		this.tours.push(null);
	}
	if (initialize) {
		for (var i = 0; i < size; i++) {
			var tour = new Tour();
			tour.generateIndividual();
			this.tours[i] = tour;
		}
	}
	this.getFittest = function() {
		var fittestTour = this.tours[0];
		for (var i = 0; i < this.tours.length; i++) {
			if (this.tours[i].getFitness() > fittestTour.getFitness()) {
				fittestTour = this.tours[i];
			}
		}
		return fittestTour;
	}
	this.size = function() {
		return this.tours.length;
	}
}

function GA() {
	this.mutationRate = 0.1;
	this.tournamentSize = 5;
	this.elitism = true;
	this.selectParent = function(population) {
		var tournament = new Population(this.tournamentSize, false);
		for (var i = 0; i < this.tournamentSize; i++) {
			var ind = Math.floor(Math.random() * population.size());
			tournament.tours[i] = population.tours[ind];
		}
		return tournament.getFittest();
	}
	this.crossover = function(parentA, parentB) {
		var child = new Tour();
		
		var rand1 = Math.floor(Math.random() * parentA.tour.length);
		var rand2 = Math.floor(Math.random() * parentA.tour.length);

		var startPos = Math.min(rand1, rand2);
		var endPos = Math.max(rand1, rand2);

		for (var i = startPos; i <= endPos; i++) {
			child.tour[i] = parentA.tour[i];
		}

		for (var i = 0; i < child.tour.length; i++) {
			if (child.tour[i] == null) {
				for (var j = 0; j < parentB.tour.length; j++) {
					if (!child.containsMarker(parentB.tour[j])) {
						child.tour[i] = parentB.tour[j];
					}
				}
			}
		}
		return child;
	}
	this.mutate = function(tour) {
		for (var i = 0; i < tour.tour.length; i++) {
            if (Math.random() < this.mutationRate) {
                var j = Math.floor(Math.random() * tour.tour.length);

                var markerA = tour.tour[i];
                var markerB = tour.tour[j];

                tour.tour[i] = markerB;
                tour.tour[j] = markerA;
            }
        }
	}
	this.evolvePopulation = function(population) {
		var newPopulation = new Population(population.size(), false);
		var elitismOffset = 0;
		if (this.elitism) {
			elitismOffset = 1;
			newPopulation.tours[0] = population.getFittest();
		}
		for (var i = elitismOffset; i < population.size(); i++) {
			var parentA = this.selectParent(population);
			var parentB = this.selectParent(population);
			var child = this.crossover(parentA, parentB);
			this.mutate(child);
			newPopulation.tours[i] = child;
		}
		return newPopulation;
	}
}

var main = function() {
	$("#start-button").click(function() {
		if (markers.length >= 2) {
	  		runDistanceMatrixService();
	  	} else {
	  		alert("Click on the map to select a maximum of 10 destinations.");
	  	}
	});

	$("#clear-button").click(clearMap);
}

$(document).ready(main);