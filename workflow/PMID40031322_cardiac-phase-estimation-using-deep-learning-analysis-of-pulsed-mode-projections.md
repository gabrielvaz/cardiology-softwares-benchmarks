# Cardiac Phase Estimation Using Deep Learning Analysis of Pulsed-Mode Projections: Toward Autonomous Cardiac CT Imaging.

- Authors: (see PubMed)
- Year: 2025
- Venue: IEEE transactions on medical imaging
- Link: https://doi.org/10.1109/TMI.2025.3536160
- DOI: 10.1109/TMI.2025.3536160
- Study type: Other
- Clinical context: ECG, Cardiac imaging

## Abstract

Cardiac CT plays an important role in diagnosing heart diseases but is conventionally limited by its complex workflow that requires dedicated phase and bolus tracking devices [e.g., electrocardiogram (ECG) gating]. This work reports first progress towards robust and autonomous cardiac CT exams through joint deep learning (DL) and analytical analysis of pulsed-mode projections (PMPs). To this end, cardiac phase and its uncertainty were simultaneously estimated using a novel projection domain cardiac phase estimation network (PhaseNet), which utilizes sliding-window multi-channel feature extraction strategy and a long short-term memory (LSTM) block to extract temporal correlation between time-distributed PMPs. An uncertainty-driven Viterbi (UDV) regularizer was developed to refine the DL estimations at each time point through dynamic programming. Stronger regularization was performed at time points where DL estimations have higher uncertainty. The performance of the proposed phase estimation pipeline was evaluated using accurate physics-based emulated data. PhaseNet achieved improved phase estimation accuracy compared to the competing methods in terms of RMSE (~50% improvement vs. standard CNN-LSTM; ~24% improvement vs. multi-channel residual network). The added UDV regularizer resulted in an additional ~14% improvement in RMSE, achieving accurate phase estimation with <6% RMSE in cardiac phase (phase ranges from 0-100%). To our knowledge, this is the first publication of prospective cardiac phase estimation in the projection domain. Combined with our previous work on PMP-based bolus curve estimation, the proposed method could potentially be used to achieve autonomous cardiac scanning without ECG device and expert-in-the-loop bolus timing.

Note: Full text not available for conversion; PDF not in PMC.
