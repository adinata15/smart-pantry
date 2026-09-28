# Receipt reading sits behind an OCR port

The household reviews text, then commits stock. The image is not the system of record. The default OCR adapter runs in the browser and sends recognized text only. A cloud adapter is the same port on the server and stays unconfigured until credentials exist. Both paths share one parse, review, and commit flow. Receipt text is not sent to the recommendation model.

Considered options: upload and store the photo, or parse only on the server. Storing images adds a private-data store the product does not need, and it would couple intake to whichever OCR vendor is configured first.
