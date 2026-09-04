# A deep learning modular ECG approach for cardiologist assisted adjudication of atrial fibrillation and atrial flutter episodes.

- Authors: (see PubMed)
- Year: 2024
- Venue: Heart rhythm O2
- Link: https://doi.org/10.1016/j.hroo.2024.09.007
- DOI: 10.1016/j.hroo.2024.09.007
- Study type: Usability/UX study
- Clinical context: ECG, Holter

## Abstract

BACKGROUND: Detection of atrial tachyarrhythmias (ATA) on long-term electrocardiogram (ECG) recordings is a prerequisite to reduce ATA-related adverse events. However, the burden of editing massive ECG data is not sustainable. Deep learning (DL) algorithms provide improved performances on resting ECG databases. However, results on long-term Holter recordings are scarce. OBJECTIVE: We aimed to build and evaluate a DL modular software using ECG features well known to cardiologists with a user interface that allows cardiologists to adjudicate the results and drive a second DL analysis. METHODS: Using a large (n = 187 recordings, 249,419 one-minute samples), beat-to-beat annotated, two-lead Holter database, we built a DL algorithm with a modular structure mimicking expert physician ECG interpretation to classify atrial rhythms. The DL network includes 3 modules (cardiac rhythm regularity, electrical atrial waveform, and raw voltage by time data) followed by a decision network and a long-term weighting factor. The algorithm was validated on an external database. RESULTS: F1 scores of our classifier were 99% for ATA detection, 95% for atrial fibrillation, and 90% for atrial flutter. Using the external Massachusetts Institute of Technology database, the classifier obtains an F1-score of 97% for the normal sinus rhythm class and 96% for the ATA class. Residual errors could be corrected by manual deactivation of 1 module in 7 of 15 of the recordings, with an accuracy < 90%. CONCLUSION: A DL modular software using ECG features well known to cardiologists provided an excellent overall performance. Clinically significant residual errors were most often related to the classification of the atrial arrhythmia type (fibrillation vs flutter). The modular structure of the algorithm helped to edit and correct the artificial intelligence-based first-pass analysis and will provide a basis for explainability.

Note: Full text not available for conversion; PDF not in PMC.
