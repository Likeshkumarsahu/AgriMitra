---
license: mit
library_name: scikit-learn
tags:
  - agriculture
  - crop-recommendation
  - tabular-classification
  - random-forest
  - scikit-learn
datasets:
  - logicmatters06/agrimitra-dataset
metrics:
  - accuracy
  - f1
model-index:
  - name: AgriMitra Crop Recommendation RandomForest
    results:
      - task:
          type: tabular-classification
          name: Crop recommendation
        dataset:
          name: AgriMitra merged crop dataset (51 classes)
          type: custom
        metrics:
          - type: accuracy
            value: 0.996969696969697
          - type: f1
            name: Macro F1
            value: 0.9960722908695423
          - type: f1
            name: Weighted F1
            value: 0.9969649520355554
---

# AgriMitra Crop Recommendation Model

A scikit-learn `RandomForestClassifier` that recommends a crop from seven soil and
climate inputs:

`N`, `P`, `K`, `temperature`, `humidity`, `ph`, `rainfall`

The model predicts one of **51 crop labels**. AgriMitra only displays the 22 crops
that also have a full 15-section guide in its knowledge base; the remaining labels
are still part of the trained classifier and are exposed through the response's
`coverage` value. The AgriMitra UI shows an amber warning whenever coverage drops
below 50%, so raw probabilities are not presented as certainty.

## Files

| File | Description |
| --- | --- |
| `crop_recommendation_model.pkl` | Joblib artifact (RandomForestClassifier, 51 classes) |
| `metrics.json` | Holdout metrics and top confusions |
| `confusion-matrix.png` | Full 51 × 51 holdout confusion matrix |

## Holdout metrics

Evaluated on the same **80/20 stratified holdout split** (`random_state=42`) used in
`crop-ml/trainingModel.ipynb`.

| Metric | Value |
| --- | ---: |
| Test samples | 1,320 |
| Correct | 1,316 |
| Accuracy | **0.99697** |
| Macro precision | 0.99635 |
| Macro recall | 0.99608 |
| Macro F1 | **0.99607** |
| Weighted F1 | 0.99696 |

Top confusions: `jute → rice` (2), `blackgram → maize` (1),
`mothbeans → pigeonpeas` (1).

## Training data

The 6,596-row merged dataset is in the AgriMitra repository
(`crop-ml/merged_crop_dataset.csv`) and the source corpus is on Hugging Face:
[`logicmatters06/agrimitra-dataset`](https://huggingface.co/datasets/logicmatters06/agrimitra-dataset).

The first 22 crop classes (100 rows each) match the widely used public
Kaggle Crop Recommendation dataset. The remaining 29 classes are additional
Indian crop records compiled for this project. Verify the original dataset
licences before redistributing the training CSV.

## Usage

```python
import joblib
import pandas as pd

model = joblib.load("crop_recommendation_model.pkl")
features = ["N", "P", "K", "temperature", "humidity", "ph", "rainfall"]
row = pd.DataFrame([[90, 50, 50, 27, 75, 6.5, 1200]], columns=features)

proba = model.predict_proba(row)[0]
labels = model.classes_
ranked = sorted(zip(labels, proba), key=lambda item: item[1], reverse=True)
print(ranked[:5])
```

The artifact was trained and saved with **scikit-learn 1.9.1**, the version pinned
in `requirements.txt`. It therefore loads without an `InconsistentVersionWarning`.
Keep the training and runtime versions aligned when regenerating the artifact.

## Limitations

- The model is trained on tabular agronomic ranges, not local soil tests.
- It does not account for season, irrigation method, market price, or variety.
- Rare classes have very few samples; the aggregate holdout accuracy is dominated
  by the larger classes.
- Recommendations are suggestions, not a substitute for local extension advice.
- Pesticide and fertilizer doses are intentionally **not** produced by this model.

## Licence

The model artifact and training code are released under the MIT licence. The
source PDFs and derived corpus remain subject to their original authors' rights;
see the dataset card for details.
