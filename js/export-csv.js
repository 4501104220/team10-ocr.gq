function export_csv() {
    console.log($(".output").val());
    console.log(document.getElementsByClassName("u-full-width info")[0]);

    var hiddenElement = document.createElement('a');
    var elements_input = document.getElementsByClassName("u-full-width info");
    var elements_output = document.getElementsByClassName("output");

    var txt = "Copyright (c) 2021 4501104220\nStt, Tên file, Text\n\n";
    for (let i = 0; i < elements_input.length; i++) {
        var index = (i + 1).toString();
        var text_in = elements_input[i].defaultValue;
        var text_out = elements_output[i].innerHTML;
        text_out = text_out.replace(/[,*+@°Š~`¡!’»\-?^${}()|[\]\\]/g, '');
        text_out = text_out.replace(/[\n\r]/g, ' ');
        txt = txt + index + ", " + text_in + ", " + text_out + "\n\n"
    }

    hiddenElement.href = 'data:text/csv;charset=utf-16,' + encodeURI(txt);
    hiddenElement.target = '_blank';
    hiddenElement.download = 'export.csv';
    hiddenElement.click();
}

