(function () {
    var video = document.querySelector('video');

    var pictureWidth = 720;
    var pictureHeight = 1080;

    var fxCanvas = null;
    var texture = null;

    function checkRequirements() {
        var deferred = new $.Deferred();

        if (!Modernizr.getusermedia) {
            deferred.reject('Your browser doesn\'t support getUserMedia (according to Modernizr).');
        }

        if (Modernizr.webgl) {
            try {
                fxCanvas = fx.canvas();
            } catch (e) {
                deferred.reject('Sorry, glfx.js failed to initialize. WebGL issues?');
            }
        } else {
            deferred.reject('Your browser doesn\'t support WebGL (according to Modernizr).');
        }

        deferred.resolve();

        return deferred.promise();
    }

    function searchForRearCamera() {
        var deferred = new $.Deferred();
        if (navigator.mediaDevices.getUserMedia) {
            navigator.mediaDevices.enumerateDevices()
                .then(function (sources) {
                    var rearCameraIds = sources.filter(function (source) {
                        return (source.kind === 'videoinput' && source.label.toLowerCase().indexOf('back') !== -1);
                    }).map(function (source) {
                        return source.deviceId;
                    });

                    if (rearCameraIds.length) {
                        deferred.resolve(rearCameraIds[0]);
                    } else {
                        deferred.resolve(null);
                    }
                });
        } else {
            deferred.resolve(null);
        }

        return deferred.promise();
    }

    function setupVideo(rearCameraId) {
        var deferred = new $.Deferred();
        var videoSettings = {
            video: {
                optional: [
                    {
                        width: {min: pictureWidth}
                    },
                    {
                        height: {min: pictureHeight}
                    }
                ]
            }
        };

        if (rearCameraId) {
            videoSettings.video.optional.push({
                sourceId: rearCameraId
            });
        }

        navigator.mediaDevices.getUserMedia(videoSettings)
            .then(function (stream) {
                video.srcObject = stream;

                video.addEventListener("loadedmetadata", function (e) {

                    pictureWidth = this.videoWidth;
                    pictureHeight = this.videoHeight;

                    if (!pictureWidth && !pictureHeight) {
                        var waitingForSize = setInterval(function () {
                            if (video.videoWidth && video.videoHeight) {
                                pictureWidth = video.videoWidth;
                                pictureHeight = video.videoHeight;

                                clearInterval(waitingForSize);
                                deferred.resolve();
                            }
                        }, 100);
                    } else {
                        deferred.resolve();
                    }
                }, false);
            }).catch(function () {
            deferred.reject('There is no access to your camera, have you denied it?');
        });

        return deferred.promise();
    }

    function upload() {
        //Open Dialog
        document.getElementById('imageLoader').click();
        changeStep(2);

        var imageLoader = document.getElementById('imageLoader');
        imageLoader.addEventListener('change', handleImage, false);
        var img = document.querySelector('#step2 img');

        function handleImage(e) {
            var reader = new FileReader();
            reader.onload = function (event) {
                img.onload = function () {
                    step2b();
                }
                img.src = event.target.result;
            }
            reader.readAsDataURL(e.target.files[0]);
        }
    }

    function step1() {
        checkRequirements()
            .then(searchForRearCamera)
            .then(setupVideo)
            .done(function () {
                $('#takePicture').removeAttr('disabled');
                $('#step1 figure').removeClass('not-ready');
            })
            .fail(function (error) {
                showError(error);
            });
    }

    function step2a() {
        var canvas = document.querySelector('#step2 canvas');
        var img = document.querySelector('#step2 img');
        canvas.width = pictureWidth;
        canvas.height = pictureHeight;

        var ctx = canvas.getContext('2d');
        ctx.drawImage(video, 0, 0);

        //modify
        texture = fxCanvas.texture(canvas);
        fxCanvas.draw(texture)
            .hueSaturation(-1, -1) //grayscale
            .unsharpMask(20, 2)
            .brightnessContrast(0.2, 0.9)
            .update();

        window.texture = texture;
        window.fxCanvas = fxCanvas;

        //setup the crop utility
        $(img)
            .one('load', function () {
                if (!$(img).data().Jcrop) {
                    $(img).Jcrop({
                        onSelect: function () {
                            $('#adjust').removeAttr('disabled');
                        }
                    });
                } else {
                    $('.jcrop-holder img').attr('src', fxCanvas.toDataURL());
                }
            })
            .attr('src', fxCanvas.toDataURL());
    }

    function step2b() {
        var canvas = document.querySelector('#step2 canvas');
        var img = document.querySelector('#step2 img');
        //canvas.width = 800;
        //canvas.height = 1000;
        canvas.width = pictureWidth;
        canvas.height = pictureHeight;
        var scale = Math.min(canvas.width / img.width, canvas.height / img.height);
        var x = (canvas.width / 2) - (img.width / 2) * scale;
        var y = (canvas.height / 2) - (img.height / 2) * scale;
        var ctx = canvas.getContext('2d');
        ctx.drawImage(img, x, y, img.width * scale, img.height * scale);

        //modify
        texture = fxCanvas.texture(canvas);
        fxCanvas.draw(texture)
            .hueSaturation(-1, -1)//grayscale
            .unsharpMask(20, 2)
            .brightnessContrast(0.2, 0.9)
            .update();

        window.texture = texture;
        window.fxCanvas = fxCanvas;

        //setup the crop utility
        $(img)
            .one('load', function () {
                if (!$(img).data().Jcrop) {
                    $(img).Jcrop({
                        onSelect: function () {
                            $('#adjust').removeAttr('disabled');
                        }
                    });
                } else {
                    $('.jcrop-holder img').attr('src', fxCanvas.toDataURL());
                }
            })
            .attr('src', fxCanvas.toDataURL());
    }

    function step3() {
        var canvas = document.querySelector('#step3 canvas');
        var step2Image = document.querySelector('#step2 img');
        var cropData = $(step2Image).data().Jcrop.tellSelect();

        var scale = step2Image.width / $(step2Image).width();

        canvas.width = cropData.w * scale;
        canvas.height = cropData.h * scale;

        var ctx = canvas.getContext('2d');
        ctx.drawImage(
            step2Image,
            cropData.x * scale,
            cropData.y * scale,
            cropData.w * scale,
            cropData.h * scale,
            0,
            0,
            cropData.w * scale,
            cropData.h * scale);

        var spinner = $('.spinner2');
        spinner.show();
        $('blockquote p').text('');
        $('blockquote footer').text('');

        Tesseract.recognize(ctx, 'vie').then(function (result) {
            var resultText = result.text ? result.text.trim() : '';
            spinner.hide();
            //$('blockquote p').html('&bdquo;' + resultText + '&ldquo;');
            $('blockquote p').html(resultText);
            $('blockquote footer').text('(' + resultText.length + ' characters)');
            document.getElementById('qid').value = resultText;
        });
    }

    step1();
    $('.help').popover();

    function changeStep(step) {
        if (step === 1) {
            video.play();
        } else {
            video.pause();
        }

        $('body').attr('class', 'step' + step);
        $('.nav li.active').removeClass('active');
        $('.nav li:eq(' + (step - 1) + ')').removeClass('disabled').addClass('active');
    }

    function showError(text) {
        $('.alert').show().find('span').text(text);
    }

    $('#brightness, #contrast').on('change', function () {
        var brightness = $('#brightness').val() / 100;
        var contrast = $('#contrast').val() / 100;
        var img = document.querySelector('#step2 img');

        fxCanvas.draw(texture)
            .hueSaturation(-1, -1)
            .unsharpMask(20, 2)
            .brightnessContrast(brightness, contrast)
            .update();

        img.src = fxCanvas.toDataURL();
        $('.jcrop-holder img').attr('src', fxCanvas.toDataURL());
    });

    $('#takePicture').click(function () {
        step2a();
        changeStep(2);
    });

    $('#btnFileUpload').click(function () {
        upload();
    });

    //done
    $('#adjust').click(function () {
        step3();
        changeStep(3);
    });

    $('#go-back').click(function () {
        changeStep(2);
    });

    $('#start-over').click(function () {
        changeStep(1);
        location.reload()
    });

    $('.nav').on('click', 'a', function () {
        if (!$(this).parent().is('.disabled')) {
            var step = $(this).data('step');
            changeStep(step);
        }

        return false;
    });



    // NEW FEATURE
        'use strict';

        // Increment for each image
        let uniqueId = 0;

        /**
         * @param type URL, Clipboard, File, Folder
         * @returns {string}
         */
        function buildAndAddResultHtml(type, typeInfo) {
            const id = uniqueId++;

            const typeInfoHtml = typeInfo ?
                "<input type='text' value='" + typeInfo + "' onclick='this.focus();' readonly='readonly' class='u-full-width info'>"
                : "";

            const html =
                "<div id='result-" + id + "' class='column no-margin result loading' style='position:relative'>" +
                "<h6 class='no-margin'>" + type + "</h6>" +
                typeInfoHtml +
                "<div class='row' style='margin-top:10px'>" +
                "<div class='columns two' style='text-align: center'>" +
                "<div class='img-holder'>" +
                "<img class='input'>" +
                "</div>" +
                "<small class='image-size' style='color:lightgray'>...x...</small>" +
                "</div>" +
                "<div class='columns ten mb-5'>" +
                "<textarea class='output' rows='5' onclick='this.focus();' spellcheck='true'>Results here</textarea>" +
                "</div>" +
                "</div>" +
                "<div class='spinner2'><div class='lds-ellipsis'><div></div><div></div><div></div><div></div></div></div>" +
                "</div>";

            $("#results").prepend(html);
            $("#placeholder").hide();

            return id;
        }

        /**
         * Do the OCR
         */
        async function translateImgSrc(src, resultElement, outputElement) {
            console.log("Translating image");

            const worker = new Tesseract.createWorker();
            await worker.load();
            // await worker.loadLanguage('eng');
            await worker.loadLanguage('vie');
            // await worker.initialize('eng');
            await worker.initialize('vie');

            const {data} = await worker.recognize(src);

            console.log(data);

            outputElement.text(data.text);
            resultElement.removeClass("loading");
        }

        function loadAsFile(image, method, methodInfo) {
            const id = buildAndAddResultHtml("File (" + method + ")", methodInfo);
            const result = $("#result-" + id);
            const input = result.find(".input");
            const inputSize = result.find(".image-size");
            const output = result.find(".output");

            const reader = new FileReader();
            reader.onload = function (e) {
                input.attr("src", e.target.result);
                input.on("load", function () {
                    const temp = new Image();
                    temp.onload = function () {
                        inputSize.text(temp.width + "x" + temp.height);
                        translateImgSrc(temp.src, result, output);
                    };
                    temp.src = input.attr("src");
                });
            };
            reader.readAsDataURL(image);
        }

        function loadAsURL(url) {
            const id = buildAndAddResultHtml("URL", url);
            const result = $("#result-" + id);
            const input = result.find(".input");
            const inputSize = result.find(".image-size");
            const output = result.find(".output");

            translateImgSrc(url, result, output);

            input.attr("src", url);

            const temp = new Image();
            temp.onload = function () {
                inputSize.text(temp.width + "x" + temp.height);
            };
            temp.src = url;
        }

        // Wait for the page to finish loading before we attach listeners
        $(document).ready(function () {

            // Drag & Drop listener
            document.body.addEventListener('drop', async function (e) {
                e.stopPropagation();
                e.preventDefault();

                let file = e.dataTransfer.files[0];
                console.log("Loading file");
                console.log(file);

                loadAsFile(file, "Drag/Drop", file.name);
            });

            // Clipboard paste listener
            document.onpaste = function (e) {
                const items = e.clipboardData.items;

                for (let i = 0; i < items.length; i++) {
                    if (/^image\/(p?jpeg|gif|png)$/i.test(items[i].type)) {
                        const file = items[i].getAsFile();

                        loadAsFile(file, "Clipboard", new Date().toISOString());

                        e.preventDefault();
                        return;
                    }
                }
            };

            // File chooser listener
            $("#file-chooser").change(function (e) {
                const files = e.target.files;
                for (let i = 0; i < files.length; i++) {
                    loadAsFile(files[i], "Browse", files[i].name);
                }
            });

            // Folder chooser listener
            $("#folder-chooser").change(function (e) {
                const files = e.target.files;
                for (let i = 0; i < files.length; i++) {
                    if (files[i].type.substring(0, files[i].type.indexOf("/")) != "image") {
                        continue;
                    }
                    loadAsFile(files[i], "Browse", files[i].name);
                }
            });

            // URL(s) list listener & sample links
            const samples = ["sample-dark-text-screenshot.png", "sample-scanned-book-page.png", "sample-screenshot.png"];
            let baseUrl = window.location.href;
            baseUrl = baseUrl.substring(0, baseUrl.lastIndexOf("/"));
            for (let i = 0; i < samples.length; i++) {
                samples[i] = baseUrl + "/img/" + samples[i];
            }
            $("#url-list").val(samples.join("\r\n"));
            $("#url-submit").on('click', function () {
                const text = $("#url-list").val();
                if (text) {
                    const urls = text.split("\n");
                    for (let i = 0; i < urls.length; i++) {
                        const url = urls[i].trim();
                        try {
                            new URL(url);   // Valid URL
                            loadAsURL(url);
                        } catch (_) {       // Invalid URL
                            console.log("Invalid url " + url)
                        }
                    }
                } else {
                    console.log("URLs input was empty")
                }
            });
        });

        console.log('Data successfully parsed!')
        console.timeEnd('Time used');


})();
