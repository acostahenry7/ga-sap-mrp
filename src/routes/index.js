const express = require("express");
const router = express.Router();
const authCtrl = require("../controller/auth");
const mrpCtrl = require("../controller/mrp");
const brandCtrl = require("../controller/brand");
const prevDataCtrl = require("../controller/prevData");
const draftsCtrl = require("../controller/drafts");
const path = require("path");
const multer = require("multer");
const fs = require("fs");

module.exports = (app) => {
  //AUTH
  router.post("/login", (req, res) => {
    authCtrl
      .login(req.body)
      .then((session) => {
        res.send(session);
      })
      .catch((err) => {
        res.send(err);
      });
  });

  //MRP
  router.post("/mrp", (req, res) => {
    mrpCtrl
      .create(req.query, req.body)
      .then((data) => {
        res.send(data);
      })
      .catch((err) => {
        res.status(400).send({ error: true, body: err.message });
      });
  });

  router.get("/mrp/next", (req, res) => {
    console.log("here", req.query);

    mrpCtrl
      .getNextMrpByBrand(req.query)
      .then((data) => {
        res.send(data);
      })
      .catch((err) => {
        console.log(err);
        res.send(err);
      });
  });

  router.get("/mrp", (req, res) => {
    mrpCtrl
      .get(req.query)
      .then((data) => {
        res.send(data);
      })
      .catch((err) => {
        console.log(err);
        res.send(err);
      });
  });

  router.get("/mrp-detail", (req, res) => {
    mrpCtrl
      .getMrpDetailById(req.query)
      .then((data) => {
        res.send(data);
      })
      .catch((err) => {
        console.log(err);
        res.send(err);
      });
  });

  router.put("/mrp", (req, res) => {
    mrpCtrl
      .update(req.query, req.body)
      .then((data) => {
        res.send(data);
      })
      .catch((err) => {
        res.status(400).send({ error: true, body: err.message });
      });
  });

  router.delete("/mrp", (req, res) => {
    mrpCtrl
      .remove(req.query)
      .then((data) => {
        res.send(data);
      })
      .catch((err) => {
        console.log(err);
        res.status(500).send({ error: true, body: err.message });
      });
  });

  //BRAND
  router.post("/brand", (req, res) => {
    console.log(req.body);

    brandCtrl
      .create(req.query, req.body)
      .then((data) => {
        res.send(data);
      })
      .catch((err) => {
        res.status(400).send({ error: true, body: err.message });
      });
  });

  router.get("/brand", (req, res) => {
    brandCtrl
      .get(req.query)
      .then((brands) => {
        res.send(brands);
      })
      .catch((err) => {
        res.send(err);
      });
  });

  router.put("/brand", (req, res) => {
    brandCtrl
      .update(req.query, req.body)
      .then((data) => {
        res.send(data);
      })
      .catch((err) => {
        res.status(400).send({ error: true, body: err.message });
      });
  });

  router.delete("/brand", (req, res) => {
    brandCtrl
      .remove(req.query)
      .then((data) => {
        res.send(data);
      })
      .catch((err) => {
        console.log(err);
        res.send(err);
      });
  });

  //MODEL
  router.get("/models", (req, res) => {
    prevDataCtrl
      .getModelList(req.query)
      .then((models) => {
        res.send(models);
      })
      .catch((err) => {
        res.send(err);
      });
  });

  //OTHER
  router.get("/stock-summary", (req, res) => {
    prevDataCtrl
      .getStockSummary(req.query)
      .then((sum) => {
        res.send(sum);
      })
      .catch((err) => {
        res.send(err);
      });
  });
  router.get("/providers", (req, res) => {
    prevDataCtrl
      .getProviders(req.query)
      .then((sum) => {
        res.send(sum);
      })
      .catch((err) => {
        res.send(err);
      });
  });
  router.get("/currencies", (req, res) => {
    prevDataCtrl
      .getCurrencies(req.query)
      .then((sum) => {
        res.send(sum);
      })
      .catch((err) => {
        res.send(err);
      });
  });

  //DRAFTS (PURCHASE ORDER)
  router.post("/drafts/purchase-order", (req, res) => {
    console.log(req.body);

    draftsCtrl
      .createPurchaseOrderDraft(req.query, req.body)
      .then((data) => {
        res.send(data);
      })
      .catch((err) => {
        res.status(400).send({ error: true, body: err.message });
      });
  });

  //UPLOAD PRICE FILE
  const storage = multer.diskStorage({
    destination(req, res, cb) {
      console.log("#####", req.body);
      const route = path.join(__dirname, `../price-files`);
      fs.mkdirSync(route, { recursive: true });
      cb(null, route);
    },
    filename(req, file, cb) {
      let fName;

      if (req.body.name.lastIndexOf(".") != -1) {
        fName = req.body.name.substring(0, req.body.name.lastIndexOf("."));
      } else {
        fName = req.body.name;
      }

      //console.log("#####", fName);
      let fileExtension = file.originalname.substring(
        file.originalname.lastIndexOf(".") + 1
      );

      const filename = `${fName}.${fileExtension}`;

      req.body = {
        filepath: `${path.join(__dirname, `../price-files`)}/${filename}`,
        ...req.body,
      };

      cb(null, filename);
    },
  });

  let upload = multer({ storage });

  router.post("/upload-price-file", upload.single("file"), (req, res) => {
    mrpCtrl
      .processPriceFile(req.body)
      .then((data) => {
        res.send(data);
      })
      .catch((err) => {
        console.log(err);
      });
  });

  app.use(router);
};
